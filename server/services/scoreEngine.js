import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { ensureSeasons } from './seasons.js';

/**
 * ScoreEngine — Single place for score changes.
 *
 * Every score change must go through applyScore so that:
 *   - players.total_score is updated (source of truth),
 *   - leaderboard rows for all active seasons stay in sync.
 */
export function applyScore(playerId, amount) {
  if (!playerId || !(amount > 0)) return 0;

  const player = db.prepare('SELECT total_score FROM players WHERE id = ?').get(playerId);
  if (!player) return 0;

  const newScore = player.total_score + Math.floor(amount);
  db.prepare('UPDATE players SET total_score = ?, updated_at = ? WHERE id = ?')
    .run(newScore, new Date().toISOString(), playerId);

  ensureSeasons();

  const activeSeasons = db.prepare(
    "SELECT id FROM leaderboard_seasons WHERE status = 'active'"
  ).all();

  for (const season of activeSeasons) {
    const existing = db.prepare(
      'SELECT id, score FROM leaderboards WHERE season_id = ? AND player_id = ?'
    ).get(season.id, playerId);

    if (existing) {
      if (newScore > existing.score) {
        db.prepare('UPDATE leaderboards SET score = ? WHERE id = ?').run(newScore, existing.id);
      }
    } else {
      db.prepare(
        'INSERT INTO leaderboards (id, season_id, player_id, score, first_score_at) VALUES (?, ?, ?, ?, ?)'
      ).run(randomUUID(), season.id, playerId, newScore, new Date().toISOString());
    }
  }

  return newScore;
}
