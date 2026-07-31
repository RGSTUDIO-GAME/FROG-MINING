import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { processAutoMining } from '../services/autoMiningEngine.js';

const PACKAGES = {
  quick: { key: 'quick', price: 500, duration: 7200 },
  basic: { key: 'basic', price: 1000, duration: 18000 },
  power: { key: 'power', price: 2500, duration: 43200 },
  premium: { key: 'premium', price: 5000, duration: 86400 },
  royal: { key: 'royal', price: 15000, duration: 259200 },
};

export default async function autominingRoutes(fastify) {
  // Get auto mining status
  fastify.get('/api/automining/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    // Apply any accrued (offline) gains before returning the status.
    processAutoMining(playerId);

    const mining = db.prepare('SELECT * FROM auto_mining WHERE player_id = ?').get(playerId);
    if (!mining || mining.status !== 'active') {
      const totalScore = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);
      return reply.send({
        status: 'success',
        data: { active: false, currentScore: totalScore ? totalScore.total_score : 0 },
      });
    }

    const totalScore = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);

    return reply.send({
      status: 'success',
      data: {
        active: true,
        package: mining.package_key,
        startTime: mining.start_time,
        endTime: mining.end_time,
        totalGenerated: mining.total_generated_score,
        currentScore: totalScore ? totalScore.total_score : 0,
      },
    });
  });

  // Activate auto mining
  fastify.post('/api/automining/activate', async (request, reply) => {
    const { playerId, packageKey } = request.body || {};

    if (!playerId || !packageKey) {
      return reply.code(400).send({ status: 'error', message: 'Player ID and package key required' });
    }

    const pkg = PACKAGES[packageKey];
    if (!pkg) {
      return reply.code(400).send({ status: 'error', message: 'Invalid package' });
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    // Check if already active
    const existing = db.prepare("SELECT * FROM auto_mining WHERE player_id = ? AND status = 'active'").get(playerId);
    if (existing) {
      return reply.code(400).send({ status: 'error', message: 'Auto Mining is already active' });
    }

    // Check diamonds
    if (player.total_diamonds < pkg.price) {
      return reply.code(400).send({
        status: 'error',
        message: 'Not enough Diamonds. You have ' + player.total_diamonds + ', need ' + pkg.price,
      });
    }

    // Spend diamonds
    const newDiamonds = player.total_diamonds - pkg.price;
    db.prepare('UPDATE players SET total_diamonds = ?, updated_at = ? WHERE id = ?')
      .run(newDiamonds, new Date().toISOString(), playerId);

    // Log transaction
    db.prepare(
      'INSERT INTO transactions (id, player_id, type, amount, balance_before, balance_after, reference) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), playerId, 'spend', pkg.price, player.total_diamonds, newDiamonds, 'auto-mining-' + packageKey);

    // Activate mining (create the row if it does not exist yet)
    const now = new Date();
    const endTime = new Date(now.getTime() + pkg.duration * 1000);

    const row = db.prepare('SELECT id FROM auto_mining WHERE player_id = ?').get(playerId);
    if (row) {
      db.prepare(
        'UPDATE auto_mining SET status = ?, package_key = ?, start_time = ?, end_time = ?, last_processed = ?, total_generated_score = 0 WHERE player_id = ?'
      ).run('active', packageKey, now.toISOString(), endTime.toISOString(), now.toISOString(), playerId);
    } else {
      db.prepare(
        'INSERT INTO auto_mining (id, player_id, status, package_key, start_time, end_time, last_processed, total_generated_score) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
      ).run(randomUUID(), playerId, 'active', packageKey, now.toISOString(), endTime.toISOString(), now.toISOString());
    }

    markDataChanged();

    return reply.send({
      status: 'success',
      message: 'Auto Mining activated',
      data: {
        diamonds: newDiamonds,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
  });
}
