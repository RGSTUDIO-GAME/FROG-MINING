import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { payReferralCommission } from '../services/referral.js';

const SHOP_ENABLED = process.env.ENABLE_SIMULATED_SHOP === 'true';

export default async function diamondRoutes(fastify) {
  // Get player diamonds
  fastify.get('/api/diamonds/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT total_diamonds FROM players WHERE id = ?').get(playerId);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    return reply.send({
      status: 'success',
      data: { diamonds: player.total_diamonds },
    });
  });

  // Get shop products
  fastify.get('/api/shop/products', async (request, reply) => {
    const products = db.prepare("SELECT * FROM shop_products WHERE status = 'active'").all();

    return reply.send({
      status: 'success',
      data: { products },
    });
  });

  // Simulate purchase (for testing only — disabled by default until a real
  // payment gateway is integrated in Sprint 10). Enable with
  // ENABLE_SIMULATED_SHOP=true, otherwise clients can add diamonds for free.
  fastify.post('/api/shop/purchase', async (request, reply) => {
    const { playerId, productId } = request.body || {};

    if (!playerId || !productId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID and Product ID required' });
    }

    if (!SHOP_ENABLED) {
      return reply.code(403).send({ status: 'error', message: 'Pembayaran belum tersedia — coba lagi nanti' });
    }

    const product = db.prepare('SELECT * FROM shop_products WHERE id = ?').get(productId);
    if (!product) {
      return reply.code(404).send({ status: 'error', message: 'Product not found' });
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    // Add diamonds (simulated — in production, verify payment first)
    const totalDiamonds = product.diamond_amount + product.bonus_diamond;
    const newBalance = player.total_diamonds + totalDiamonds;

    db.prepare('UPDATE players SET total_diamonds = ?, updated_at = ? WHERE id = ?')
      .run(newBalance, new Date().toISOString(), playerId);

    // Log transaction
    db.prepare(
      'INSERT INTO transactions (id, player_id, type, amount, balance_before, balance_after, reference) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), playerId, 'purchase', totalDiamonds, player.total_diamonds, newBalance, 'shop-' + productId);

    // Log purchase
    db.prepare(
      'INSERT INTO purchases (id, player_id, product_id, status) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), playerId, productId, 'completed');

    // Komisi referral 5% ke pengundang (real-time, tanpa mengurangi Diamond teman)
    payReferralCommission(player.referrer_id, playerId, 'purchase', 'shop-' + productId, totalDiamonds);

    markDataChanged();

    return reply.send({
      status: 'success',
      message: 'Purchase successful',
      data: { diamonds: newBalance, added: totalDiamonds },
    });
  });

  // Get transaction history
  fastify.get('/api/transactions/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const txns = db.prepare('SELECT * FROM transactions WHERE player_id = ? ORDER BY created_at DESC LIMIT 50').all(playerId);

    return reply.send({
      status: 'success',
      data: { transactions: txns },
    });
  });
}
