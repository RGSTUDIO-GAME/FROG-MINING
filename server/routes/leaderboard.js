import db from '../db/database.js';
import { ensureSeasons, PERIODS } from '../services/seasons.js';

export default async function leaderboardRoutes(fastify) {
  // Get leaderboard
  fastify.get('/api/leaderboard/:type', async (request, reply) => {
    const { type } = request.params;
    const { playerId } = request.query || {};

    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return reply.code(400).send({ status: 'error', message: 'Invalid leaderboard type' });
    }

    ensureSeasons();

    const season = db.prepare(
      "SELECT * FROM leaderboard_seasons WHERE type = ? AND status = 'active'"
    ).get(type);

    if (!season) {
      return reply.send({
        status: 'success',
        data: {
          entries: [],
          playerRank: null,
          totalPlayers: 0,
          rewardPool: PERIODS[type].rewardPool,
          countdown: { remainingMs: 0, formatted: 'Ended', ended: true },
        },
      });
    }

    // Get top 100 entries with player info
    const entries = db.prepare(`
      SELECT l.*, p.username, p.avatar
      FROM leaderboards l
      JOIN players p ON l.player_id = p.id
      WHERE l.season_id = ?
      ORDER BY l.score DESC, l.first_score_at ASC
      LIMIT 100
    `).all(season.id);

    // Calculate player rank
    let playerRank = null;
    let totalPlayers = db.prepare('SELECT COUNT(*) as count FROM leaderboards WHERE season_id = ?').get(season.id).count;

    if (playerId) {
      const playerEntry = db.prepare(
        'SELECT score, first_score_at FROM leaderboards WHERE season_id = ? AND player_id = ?'
      ).get(season.id, playerId);

      if (playerEntry) {
        const betterCount = db.prepare(
          'SELECT COUNT(*) as count FROM leaderboards WHERE season_id = ? AND (score > ? OR (score = ? AND first_score_at < ?))'
        ).get(season.id, playerEntry.score, playerEntry.score, playerEntry.first_score_at);
        playerRank = betterCount.count + 1;
      }
    }

    // Calculate countdown
    const now = Date.now();
    const endTime = new Date(season.end_time).getTime();
    const remainingMs = Math.max(0, endTime - now);

    let formatted = 'Ended';
    if (remainingMs > 0) {
      const totalSec = Math.floor(remainingMs / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      if (days > 0) formatted = days + 'd ' + hours + 'h';
      else if (hours > 0) formatted = hours + 'h ' + minutes + 'm';
      else formatted = minutes + 'm ' + (totalSec % 60) + 's';
    }

    return reply.send({
      status: 'success',
      data: {
        entries: entries.map((e, i) => ({
          playerId: e.player_id,
          username: e.username,
          avatar: e.avatar,
          score: e.score,
          rank: i + 1,
          isPlayer: playerId ? e.player_id === playerId : false,
        })),
        playerRank,
        totalPlayers,
        rewardPool: season.reward_pool,
        countdown: { remainingMs, formatted, ended: remainingMs === 0 },
      },
    });
  });
}
