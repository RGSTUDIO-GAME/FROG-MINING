import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { applyScore } from '../services/scoreEngine.js';

// Simple in-memory rate limiter per player (prevents instant score spam).
// Normal play: max ~120 requests per minute per player (tap sync every 5s + runner).
const SCORE_RATE_LIMIT = Number(process.env.SCORE_RATE_LIMIT_PER_MINUTE) || 120;
const scoreBuckets = new Map();

function allowScore(playerId) {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = scoreBuckets.get(playerId) || { count: 0, resetAt: now + windowMs };
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count++;
  scoreBuckets.set(playerId, bucket);
  return bucket.count <= SCORE_RATE_LIMIT;
}

function sanitizeAmount(amount, max) {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

export default async function scoreRoutes(fastify) {
  fastify.post('/api/score/tap', async (request, reply) => {
    const { playerId, amount } = request.body || {};

    if (!playerId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID required' });
    }

    const amountToAdd = sanitizeAmount(amount, Number(process.env.MAX_TAPS_PER_REQUEST) || 500);
    if (!amountToAdd) {
      return reply.code(400).send({ status: 'error', message: 'Amount must be a positive number' });
    }

    const player = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    if (!allowScore(playerId)) {
      return reply.code(429).send({ status: 'error', message: 'Terlalu cepat — coba lagi sebentar' });
    }

    const newScore = applyScore(playerId, amountToAdd);
    markDataChanged();

    return reply.send({
      status: 'success',
      data: { score: newScore, added: amountToAdd },
    });
  });

  fastify.post('/api/score/runner', async (request, reply) => {
    const { playerId, amount } = request.body || {};

    if (!playerId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID required' });
    }

    const amountToAdd = sanitizeAmount(amount, Number(process.env.MAX_RUNNER_SCORE_PER_REQUEST) || 100000);
    if (!amountToAdd) {
      return reply.code(400).send({ status: 'error', message: 'Amount must be a positive number' });
    }

    const player = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    if (!allowScore(playerId)) {
      return reply.code(429).send({ status: 'error', message: 'Terlalu cepat — coba lagi sebentar' });
    }

    const newScore = applyScore(playerId, amountToAdd);
    markDataChanged();

    return reply.send({
      status: 'success',
      data: { score: newScore, added: amountToAdd, source: 'runner' },
    });
  });

  fastify.get('/api/score/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    return reply.send({
      status: 'success',
      data: { score: player.total_score },
    });
  });
}
