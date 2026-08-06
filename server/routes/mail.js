import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';

const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MAX_MAIL_REWARD = 1000000;

function isAdmin(request) {
  return ADMIN_KEY && request.headers['x-admin-key'] === ADMIN_KEY;
}

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

    const player = db.prepare('SELECT id FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    // Only admin (matching ADMIN_KEY header) may attach rewards to mails.
    // Regular clients may only create announcement mails — this prevents the
    // unlimited-diamond exploit via /api/mail/create + /api/mail/claim.
    let finalRewardType = null;
    let finalRewardAmount = 0;
    if (rewardType || rewardAmount) {
      if (!isAdmin(request)) {
        return reply.code(403).send({ status: 'error', message: 'Reward mail memerlukan akses admin' });
      }
      const amount = Math.floor(Number(rewardAmount) || 0);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MAIL_REWARD) {
        return reply.code(400).send({ status: 'error', message: 'Reward amount tidak valid' });
      }
      finalRewardType = rewardType === 'diamond' ? 'diamond' : null;
      finalRewardAmount = finalRewardType ? amount : 0;
    }

    const id = randomUUID();
    const now = new Date();
    const expiry = expiryDays ? new Date(now.getTime() + expiryDays * 86400000) : null;

    db.prepare(
      'INSERT INTO mails (id, player_id, title, content, category, reward_type, reward_amount, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, playerId, title, content || '', category || 'system', finalRewardType, finalRewardAmount, expiry ? expiry.toISOString() : null);

    markDataChanged();

    return reply.send({
      status: 'success',
      data: { mailId: id },
    });
  });
}
