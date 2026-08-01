import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { getSetting } from './seasons.js';
import { markDataChanged } from './backup.js';

/**
 * ReferralService — Undang Teman.
 *
 * - Setiap pemain punya kode undangan unik (ref_code).
 * - Pemain baru yang masuk lewat link undangan terikat ke pengundang (sekali saja).
 * - Pengundang mendapat 500 Diamond via Mail.
 * - Teman yang diundang mendapat 200 Diamond via Mail.
 * - Pengundang mendapat komisi 5% dari Diamond teman (Leaderboard & Top Up)
 *   secara real-time, tanpa mengurangi Diamond teman.
 */
const INVITER_BONUS = 500;
const FRIEND_BONUS = 200;
const COMMISSION_PERCENT = 5;

function mailExpiryDays() {
  const n = Number(getSetting('mail_expiration_days', 30));
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function createMail(playerId, title, content, category, amount) {
  const now = new Date();
  const expiredAt = new Date(now.getTime() + mailExpiryDays() * 86400000).toISOString();
  db.prepare(
    'INSERT INTO mails (id, player_id, title, content, category, reward_type, reward_amount, claim_status, created_at, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), playerId, title, content, category, 'diamond', amount, 'unclaimed', now.toISOString(), expiredAt);
}

export function ensureRefCode(playerId) {
  const player = db.prepare('SELECT id, ref_code FROM players WHERE id = ?').get(playerId);
  if (!player) return null;
  if (player.ref_code) return player.ref_code;
  const code = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  db.prepare('UPDATE players SET ref_code = ?, updated_at = ? WHERE id = ?').run(code, new Date().toISOString(), playerId);
  markDataChanged();
  return code;
}

export function resolveReferrer(refParam) {
  if (!refParam || typeof refParam !== 'string') return null;
  const ref = refParam.trim();
  if (!ref) return null;
  return (
    db.prepare("SELECT id FROM players WHERE ref_code = ? AND status = 'active'").get(ref) ||
    db.prepare("SELECT id FROM players WHERE id = ? AND status = 'active'").get(ref) ||
    null
  );
}

/**
 * Bind a new player to their inviter. Runs once at account creation.
 * Returns true if bound.
 */
export function bindReferral(newPlayerId, refParam) {
  if (!newPlayerId || !refParam) return false;

  const referrer = resolveReferrer(refParam);
  if (!referrer || referrer.id === newPlayerId) return false;

  const existing = db.prepare('SELECT referrer_id FROM players WHERE id = ?').get(newPlayerId);
  if (!existing || existing.referrer_id) return false;

  db.prepare('UPDATE players SET referrer_id = ?, updated_at = ? WHERE id = ?')
    .run(referrer.id, new Date().toISOString(), newPlayerId);

  createMail(
    referrer.id,
    '🎁 Bonus Undang Teman',
    'Teman kamu baru saja bergabung lewat link undanganmu! Bonus 500 Diamond telah dikirim. Ajak lebih banyak teman untuk bonus lebih besar!',
    'referral',
    INVITER_BONUS
  );
  createMail(
    newPlayerId,
    '🎉 Hadiah Undangan',
    'Selamat datang! Kamu diundang oleh temanmu. Ini hadiah 200 Diamond untuk kamu. Jangan lupa claim dan mulai menambang!',
    'referral',
    FRIEND_BONUS
  );

  markDataChanged();
  return true;
}

/**
 * Pay 5% commission to the referrer when the invited friend earns diamonds
 * (leaderboard reward or shop top up). Never reduces the friend's diamonds.
 * Deduplicated by (source_type, source_ref) so it can only be paid once.
 */
export function payReferralCommission(referrerId, sourcePlayerId, sourceType, sourceRef, earnedAmount) {
  if (!referrerId || !sourcePlayerId || !sourceType || !sourceRef) return false;
  const commission = Math.floor((Number(earnedAmount) || 0) * COMMISSION_PERCENT / 100);
  if (commission <= 0) return false;

  const exists = db.prepare('SELECT id FROM referral_bonuses WHERE source_type = ? AND source_ref = ?')
    .get(sourceType, sourceRef);
  if (exists) return false;

  db.prepare(
    'INSERT INTO referral_bonuses (id, player_id, source_player_id, source_type, source_ref, amount) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), referrerId, sourcePlayerId, sourceType, sourceRef, commission);

  createMail(
    referrerId,
    '💎 Komisi Referral 5%',
    'Teman yang kamu undang mendapatkan ' + (Number(earnedAmount) || 0).toLocaleString('id-ID') +
      ' Diamond. Kamu mendapat komisi 5% (' + commission.toLocaleString('id-ID') +
      ' Diamond). Terus ajak teman supaya komisimu makin besar!',
    'referral',
    commission
  );

  markDataChanged();
  return true;
}
