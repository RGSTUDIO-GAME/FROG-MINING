import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { ensureSeasons } from '../services/seasons.js';

export default async function scoreRoutes(fastify) {
  fastify.post('/api/score/tap', async (request, reply) => {
    const { playerId, amount } = request.body || {};

    if (!playerId) {
      return reply.code(400).send({ status: 'error', message: 'Player ID required' });
    }

    const validAmount = Math.max(1, Math.floor(Number(amount) || 1));

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    const newScore = player.total_score + validAmount;

    db.prepare('UPDATE players SET total_score = ?, updated_at = ? WHERE id = ?')
      .run(newScore, new Date().toISOString(), playerId);

    // Ensure leaderboard seasons exist
    ensureSeasons();

    // Update all active leaderboard entries
    const activeSeasons = db.prepare(
      "SELECT id FROM leaderboard_seasons WHERE status = 'active'"
    ).all();

    for (const season of activeSeasons) {
      const existing = db.prepare(
        'SELECT id, score FROM leaderboards WHERE season_id = ? AND player_id = ?'
      ).get(season.id, playerId);

      if (existing) {
        if (newScore > existing.score) {
          db.prepare('UPDATE leaderboards SET score = ? WHERE id = ?')
            .run(newScore, existing.id);
        }
      } else {
        db.prepare(
          'INSERT INTO leaderboards (id, season_id, player_id, score, first_score_at) VALUES (?, ?, ?, ?, ?)'
        ).run(randomUUID(), season.id, playerId, newScore, new Date().toISOString());
      }
    }

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
