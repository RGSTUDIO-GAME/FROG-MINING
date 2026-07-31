import db from '../db/database.js';
import { applyScore } from './scoreEngine.js';

/**
 * AutoMiningEngine — Processes active auto-mining sessions.
 *
 * Auto Mining adds +1 score per second while active, even when the player
 * is offline. Gains are calculated from last_processed to now and applied
 * through applyScore (which keeps the leaderboard in sync).
 */
export function processAutoMining(playerId = null) {
  const rows = playerId
    ? db.prepare('SELECT * FROM auto_mining WHERE player_id = ?').all(playerId)
    : db.prepare("SELECT * FROM auto_mining WHERE status = 'active'").all();

  let changed = false;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const mining of rows) {
    if (mining.status !== 'active') continue;

    const endTime = new Date(mining.end_time);
    const lastProcessed = mining.last_processed ? new Date(mining.last_processed) : new Date(mining.start_time);
    const remaining = Math.floor((endTime - lastProcessed) / 1000);

    if (now >= endTime) {
      // Session finished — apply the final remainder and deactivate.
      if (remaining > 0) {
        applyScore(mining.player_id, remaining);
        db.prepare('UPDATE auto_mining SET total_generated_score = total_generated_score + ? WHERE id = ?')
          .run(remaining, mining.id);
        changed = true;
      }
      db.prepare("UPDATE auto_mining SET status = 'inactive' WHERE id = ?").run(mining.id);
      changed = true;
    } else {
      const elapsed = Math.floor((now - lastProcessed) / 1000);
      const secondsToAdd = Math.max(0, Math.min(elapsed, remaining));
      if (secondsToAdd > 0) {
        applyScore(mining.player_id, secondsToAdd);
        db.prepare(
          'UPDATE auto_mining SET total_generated_score = total_generated_score + ?, last_processed = ? WHERE id = ?'
        ).run(secondsToAdd, nowIso, mining.id);
        changed = true;
      }
    }
  }

  return changed;
}
