import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { getSetting } from './seasons.js';
import { markDataChanged } from './backup.js';

/**
 * GiftsService — Server-side welcome gift.
 *
 * Every new player receives a welcome gift mail (5.000 Diamond) once.
 * Creation is idempotent: the mail only exists if the player has none yet.
 */
const WELCOME_TITLE = '🎁 Welcome Gift';
const WELCOME_CATEGORY = 'admin';

export function ensureWelcomeGift(playerId) {
  if (!playerId) return false;

  const existing = db.prepare(
    'SELECT id FROM mails WHERE player_id = ? AND title = ? AND category = ?'
  ).get(playerId, WELCOME_TITLE, WELCOME_CATEGORY);
  if (existing) return false;

  const days = Number(getSetting('welcome_gift_expiry_days', 30));
  const expiryDays = Number.isFinite(days) && days > 0 ? days : 30;
  const now = new Date();
  const expiredAt = new Date(now.getTime() + expiryDays * 86400000).toISOString();

  db.prepare(
    'INSERT INTO mails (id, player_id, title, content, category, reward_type, reward_amount, claim_status, created_at, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    randomUUID(),
    playerId,
    WELCOME_TITLE,
    'Selamat datang di Frog Mining! Nikmati 5.000 Diamond sebagai hadiah sambutan. Gunakan untuk Auto Mining! 🐸⛏️',
    WELCOME_CATEGORY,
    'diamond',
    5000,
    'unclaimed',
    now.toISOString(),
    expiredAt
  );

  markDataChanged();
  return true;
}
