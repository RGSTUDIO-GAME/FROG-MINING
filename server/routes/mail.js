import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';

export default async function mailRoutes(fastify) {
  // Get all mails for a player
  fastify.get('/api/mail/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const mails = db.prepare('SELECT * FROM mails WHERE player_id = ? ORDER BY created_at DESC').all(playerId);

    return reply.send({
      status: 'success',
      data: { mails },
    });
  });

  // Claim mail reward
  fastify.post('/api/mail/claim', async (request, reply) => {
    const { playerId, mailId } = request.body || {};

    if (!playerId || !mailId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID and Mail ID required' });
    }

    const mail = db.prepare('SELECT * FROM mails WHERE id = ? AND player_id = ?').get(mailId, playerId);
    if (!mail) {
      return reply.code(404).send({ status: 'error', message: 'Mail not found' });
    }

    if (mail.claim_status === 'claimed') {
      return reply.code(400).send({ status: 'error', message: 'Already claimed' });
    }

    // Check expiry
    if (mail.expired_at && new Date(mail.expired_at) < new Date()) {
      return reply.code(400).send({ status: 'error', message: 'Mail expired' });
    }

    // Give reward
    if (mail.reward_type === 'diamond' && mail.reward_amount > 0) {
      const player = db.prepare('SELECT total_diamonds FROM players WHERE id = ?').get(playerId);
      const newDiamonds = player.total_diamonds + mail.reward_amount;

      db.prepare('UPDATE players SET total_diamonds = ?, updated_at = ? WHERE id = ?')
        .run(newDiamonds, new Date().toISOString(), playerId);

      db.prepare(
        'INSERT INTO transactions (id, player_id, type, amount, balance_before, balance_after, reference) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), playerId, 'reward', mail.reward_amount, player.total_diamonds, newDiamonds, 'mail-' + mailId);
    }

    // Mark as claimed
    db.prepare('UPDATE mails SET claim_status = ? WHERE id = ?').run('claimed', mailId);

    markDataChanged();

    const player = db.prepare('SELECT total_diamonds FROM players WHERE id = ?').get(playerId);

    return reply.send({
      status: 'success',
      message: 'Reward claimed',
      data: {
        diamonds: player.total_diamonds,
        reward: mail.reward_amount,
      },
    });
  });

  // Create mail (used by leaderboard rewards, admin gifts, etc)
  fastify.post('/api/mail/create', async (request, reply) => {
    const { playerId, title, content, category, rewardType, rewardAmount, expiryDays } = request.body || {};

    if (!playerId || !title) {
      return reply.code(400).send({ status: 'error', message: 'Player ID and title required' });
    }

    const id = randomUUID();
    const now = new Date();
    const expiry = expiryDays ? new Date(now.getTime() + expiryDays * 86400000) : null;

    db.prepare(
      'INSERT INTO mails (id, player_id, title, content, category, reward_type, reward_amount, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, playerId, title, content || '', category || 'system', rewardType || null, rewardAmount || 0, expiry ? expiry.toISOString() : null);

    markDataChanged();

    return reply.send({
      status: 'success',
      data: { mailId: id },
    });
  });
}
