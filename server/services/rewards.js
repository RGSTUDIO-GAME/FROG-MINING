import { randomUUID } from 'crypto';
import db from '../db/database.js';
import { ensureSeasons, getSetting, setSetting } from './seasons.js';

/**
 * RewardsService — Automatic leaderboard reward distribution.
 *
 * When a season (daily/weekly/monthly) reaches its end time, the scheduler:
 *   1. Locks the season and computes final rankings.
 *   2. Allocates the reward pool using a configurable distribution.
 *   3. Creates a reward Mail for every winner (diamond).
 *   4. Closes the season and starts the next one.
 * For the monthly season, all players' scores are reset to 0 (diamonds kept).
 *
 * Configuration (system_settings, editable without code changes):
 *   reward_winner_count   -> how many players receive rewards (default 100)
 *   reward_distribution   -> JSON tiers [{from,to,percent}, ...] (default below)
 *   reward_pool_<type>    -> reward pool per period (default daily 1M / weekly 5M / monthly 20M)
 *   mail_expiration_days  -> reward mail validity (default 30)
 */
const DEFAULT_DISTRIBUTION = [
  { from: 1, to: 1, percent: 12 },
  { from: 2, to: 3, percent: 8 },
  { from: 4, to: 10, percent: 20 },
  { from: 11, to: 50, percent: 30 },
  { from: 51, to: 100, percent: 15 },
  { from: 101, to: null, percent: 10 },
];

const TYPE_LABEL = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };

function getDistribution() {
  try {
    const raw = getSetting('reward_distribution', null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fallback to default */ }
  return DEFAULT_DISTRIBUTION;
}

function getWinnerCount() {
  const n = Number(getSetting('reward_winner_count', 100));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

function getMailExpiryDays() {
  const n = Number(getSetting('mail_expiration_days', 30));
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * Allocate the reward pool to ranks 1..winnerCount using percentage tiers.
 * Leftover diamonds (rounding) are added to rank 1 so the pool is fully used.
 */
export function computeRewards(entries, pool, distribution) {
  const rewards = new Map();
  let allocated = 0;
  const tiers = [...distribution].sort((a, b) => (a.from || 0) - (b.from || 0));
  const total = entries.length;

  for (const tier of tiers) {
    const from = Math.max(1, tier.from || 1);
    // tier.to === null berarti "semua peserta dari peringkat ini ke bawah"
    const to = tier.to == null ? total : Math.min(tier.to, total);
    if (from > total) continue;

    const slice = Math.floor((pool * (tier.percent || 0)) / 100);
    const count = Math.max(1, to - from + 1);
    const per = Math.floor(slice / count);
    if (per <= 0) continue;

    for (let rank = from; rank <= to; rank++) {
      rewards.set(rank, (rewards.get(rank) || 0) + per);
      allocated += per;
    }
  }

  const leftover = pool - allocated;
  if (leftover > 0 && total > 0) {
    rewards.set(1, (rewards.get(1) || 0) + leftover);
  }

  return rewards;
}

export function distributeSeason(season) {
  const entries = db.prepare(`
    SELECT l.*, p.username
    FROM leaderboards l
    JOIN players p ON p.id = l.player_id
    WHERE l.season_id = ?
    ORDER BY l.score DESC, l.first_score_at ASC
  `).all(season.id);

  const label = TYPE_LABEL[season.type] || season.type;
  const pool = Number(season.reward_pool) || 0;
  const now = new Date();
  const expiredAt = new Date(now.getTime() + getMailExpiryDays() * 86400000).toISOString();

  const updateEntry = db.prepare(
    'UPDATE leaderboards SET rank = ?, reward_diamond = ?, reward_status = ? WHERE season_id = ? AND player_id = ?'
  );
  const insertMail = db.prepare(
    'INSERT INTO mails (id, player_id, title, content, category, reward_type, reward_amount, claim_status, created_at, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const closeSeason = db.prepare("UPDATE leaderboard_seasons SET status = 'closed' WHERE id = ?");

  const result = db.transaction(() => {
    if (entries.length === 0) {
      closeSeason.run(season.id);
      return { winners: 0 };
    }

    const rewards = computeRewards(entries, pool, getDistribution());
    let winners = 0;

    entries.forEach((entry, i) => {
      const rank = i + 1;
      const reward = rewards.get(rank) || 0;
      updateEntry.run(rank, reward, reward > 0 ? 'distributed' : 'no_reward', season.id, entry.player_id);

      if (reward > 0) {
        insertMail.run(
          randomUUID(),
          entry.player_id,
          '🏆 Hadiah Leaderboard ' + label,
          'Selamat! Kamu berada di peringkat #' + rank + ' leaderboard ' + label + '. Hadiah ' +
            reward.toLocaleString('id-ID') + ' Diamond telah dikirim. Jangan lupa di-Claim!',
          'leaderboard',
          'diamond',
          reward,
          'unclaimed',
          now.toISOString(),
          expiredAt
        );
        winners++;
      }
    });

    closeSeason.run(season.id);
    return { winners };
  })();

  console.log(
    '[Rewards] Season ' + label + ' ditutup: ' + result.winners + ' pemenang, pool ' + pool.toLocaleString('id-ID')
  );
  return { type: season.type, label, winners: result.winners, pool };
}

/**
 * Close every active season that has passed its end time.
 * Monthly seasons also reset all players' scores to 0 after distribution.
 */
export function closeExpiredSeasons() {
  const expired = db.prepare(
    "SELECT * FROM leaderboard_seasons WHERE status = 'active' AND end_time <= ?"
  ).all(new Date().toISOString());

  const closed = [];
  for (const season of expired) {
    distributeSeason(season);

    if (season.type === 'monthly') {
      db.prepare('UPDATE players SET total_score = 0, updated_at = ?').run(new Date().toISOString());
      console.log('[Rewards] Reset bulanan: semua skor pemain dikembalikan ke 0 (diamond tetap).');
    }
    closed.push(season.type);
  }

  if (closed.length > 0) {
    ensureSeasons();
  }
  return closed;
}
