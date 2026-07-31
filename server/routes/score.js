import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { applyScore } from '../services/scoreEngine.js';

export default async function scoreRoutes(fastify) {
  fastify.post('/api/score/tap', async (request, reply) => {
    const { playerId, amount } = request.body || {};

    if (!playerId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID required' });
    }

    const validAmount = Math.max(1, Math.floor(Number(amount) || 1));

    const player = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    const newScore = applyScore(playerId, validAmount);
    markDataChanged();

    return reply.send({
      status: 'success',
      data: { score: newScore, added: validAmount },
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
