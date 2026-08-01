import { randomUUID } from 'crypto';
import db from '../db/database.js';

/**
 * SeasonsService — Leaderboard periods (daily / weekly / monthly).
 * All durations and reward pools are configurable via system_settings.
 */
export const PERIODS = {
  daily: { label: 'Daily', rewardPool: 20000 },
  weekly: { label: 'Weekly', rewardPool: 100000 },
  monthly: { label: 'Monthly', rewardPool: 500000 },
};

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, String(value), new Date().toISOString());
}

function poolFor(type) {
  const fromSettings = Number(getSetting('reward_pool_' + type, null));
  return Number.isFinite(fromSettings) && fromSettings > 0 ? fromSettings : PERIODS[type].rewardPool;
}

export function getPeriodEndTime(type) {
  const now = new Date();
  switch (type) {
    case 'daily':
      now.setHours(23, 59, 59, 999);
      break;
    case 'weekly': {
      const daysUntilSunday = 6 - now.getDay();
      now.setDate(now.getDate() + daysUntilSunday);
      now.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly':
      now.setMonth(now.getMonth() + 1, 0);
      now.setHours(23, 59, 59, 999);
      break;
  }
  return now.toISOString();
}

export function ensureSeasons() {
  const types = Object.keys(PERIODS);
  for (const type of types) {
    const existing = db.prepare(
      "SELECT id FROM leaderboard_seasons WHERE type = ? AND status = 'active'"
    ).get(type);

    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO leaderboard_seasons (id, type, start_time, end_time, reward_pool, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), type, now, getPeriodEndTime(type), poolFor(type), 'active');
      console.log('[Seasons] Season ' + type + ' baru dimulai (pool ' + poolFor(type).toLocaleString('id-ID') + ')');
    }
  }
}
