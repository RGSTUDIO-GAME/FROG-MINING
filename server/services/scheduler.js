import db from '../db/database.js';
import { ensureSeasons } from './seasons.js';
import { closeExpiredSeasons } from './rewards.js';

/**
 * Scheduler — Runs time-based jobs automatically.
 *
 * Jobs:
 *   1. Ensure active leaderboard seasons exist.
 *   2. Close expired seasons and distribute rewards via Mail.
 *   3. Delete mails that have passed their expiration date.
 *
 * Interval is configurable via SCHEDULER_INTERVAL_SECONDS (default 60s).
 * A tick also runs once on startup so missed periods are processed immediately.
 */
let timer = null;

function deleteExpiredMails() {
  const result = db.prepare(
    "DELETE FROM mails WHERE expired_at IS NOT NULL AND expired_at < datetime('now')"
  ).run();
  if (result.changes > 0) {
    console.log('[Scheduler] ' + result.changes + ' mail kedaluwarsa dihapus');
  }
}

function tick() {
  try {
    ensureSeasons();
    const closed = closeExpiredSeasons();
    if (closed.length > 0) {
      console.log('[Scheduler] Season ditutup: ' + closed.join(', '));
    }
    deleteExpiredMails();
  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
  }
}

export function initScheduler() {
  const intervalSec = Math.max(30, Number(process.env.SCHEDULER_INTERVAL_SECONDS) || 60);

  // Process immediately on startup (catches periods missed while offline)
  setTimeout(tick, 5000);
  timer = setInterval(tick, intervalSec * 1000);
  console.log('[Scheduler] Berjalan setiap ' + intervalSec + ' detik');
  return timer;
}
