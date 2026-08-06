import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

const PERIODS = {
  daily: { rewardPool: 20000 },
  weekly: { rewardPool: 100000 },
  monthly: { rewardPool: 500000 },
};

function getPeriodEndTime(type) {
  const now = new Date();
  switch (type) {
    case 'daily':
      now.setHours(23, 59, 59, 999);
      break;
    case 'weekly': {
      const d = 6 - now.getDay();
      now.setDate(now.getDate() + d);
      now.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly':
      now.setMonth(now.getMonth() + 1, 0);
      now.setHours(23, 59, 59, 999);
      break;
  }
  return now.getTime();
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm ' + (s % 60) + 's';
}

/**
 * LeaderboardManager — Works with localStorage, syncs to API when available.
 */
export class LeaderboardManager {
  constructor(eventBus, gameDataManager, accountManager) {
    this.events = eventBus;
    this.gameDataManager = gameDataManager;
    this.accountManager = accountManager;
    this._storageKey = Config.STORAGE_KEY + ':leaderboard';
    this._data = null;
    this._boards = { daily: null, weekly: null, monthly: null };
  }

  async init() {
    this._data = this._load() || this._createDefaults();
    this._checkPeriodReset();
    this._ensurePeriods();
    this._refreshAll();
    // Pull the live boards from the server so other players are visible
    // even before the player taps.
    await this._fetchFromServer();
    Logger.info('Leaderboard', 'Initialized');
  }

  async updateScore(score) {
    const account = this.accountManager?.getAccount();
    if (!account) return;

    ['daily', 'weekly', 'monthly'].forEach((period) => {
      const board = this._data[period];
      if (!board || !board.active) return;

      let entry = board.entries.find((e) => e.playerId === account.id);
      if (!entry) {
        entry = {
          playerId: account.id,
          username: account.username,
          avatar: account.avatar || '🐸',
          score: 0,
          firstScoreAt: null,
        };
        board.entries.push(entry);
      }

      if (score > entry.score) {
        if (entry.score === 0) entry.firstScoreAt = Date.now();
        entry.score = score;
      }
    });

    this._save();
    this._refreshAll();
    this.events.emit('leaderboard:update');

    // Refresh the live board from the server (throttled). Tap submission is
    // handled by ScoreManager — never submit scores from here.
    this._scheduleFetch(account.id);
  }

  async _fetchFromServer() {
    const account = this.accountManager?.getAccount();
    if (!account) return;

    for (const period of ['daily', 'weekly', 'monthly']) {
      const result = await Api.getLeaderboard(period, account.id);
      if (!result.success || !result.data?.entries) continue;

      const board = this._data[period];
      if (!board) continue;

      const serverEntries = result.data.entries.map((e) => ({
        playerId: e.playerId,
        username: this._cleanName(e.username, e.playerId),
        avatar: e.avatar || '🐸',
        score: e.score,
        firstScoreAt: e.firstScoreAt || null,
      }));

      // Server is the source of truth — replace the local cache entirely so
      // deleted/old players never linger in the UI.
      board.entries = [...serverEntries];

      if (typeof result.data.playerRank === 'number') {
        board.playerRank = result.data.playerRank;
      }
      if (result.data.rewardPool) board.rewardPool = result.data.rewardPool;
      if (result.data.countdown && typeof result.data.countdown.remainingMs === 'number') {
        board.endTime = Date.now() + result.data.countdown.remainingMs;
      }
    }

    this._save();
    this._refreshAll();
    this.events.emit('leaderboard:update');
  }

  /**
   * Pull fresh boards from the server and emit an update.
   * Public wrapper used by periodic refreshes (countdown ticker).
   */
  async refresh() {
    await this._fetchFromServer();
    return this._data;
  }

  _cleanName(name, playerId) {
    const n = String(name || '').trim();
    if (n && !/^\d+$/.test(n)) return n;
    const id = String(playerId || '').replace(/[^a-z0-9]/gi, '').slice(-4);
    return id ? 'Frog#' + id : 'Frog';
  }

  _scheduleFetch(playerId) {
    const now = Date.now();
    if (now - (this._lastFetch || 0) < 10000) return; // at most once per 10s
    this._lastFetch = now;
    this._fetchFromServer(playerId).catch(() => { /* offline, ignore */ });
  }

  _refreshAll() {
    const account = this.accountManager?.getAccount();
    const playerId = account?.id || null;

    ['daily', 'weekly', 'monthly'].forEach((period) => {
      const board = this._data[period];
      if (!board) { this._boards[period] = null; return; }

      const sorted = this._sortEntries(board.entries);
      const now = Date.now();
      const remainingMs = Math.max(0, board.endTime - now);

      const ranked = sorted.map((entry, i) => ({
        ...entry,
        rank: i + 1,
        isPlayer: playerId ? entry.playerId === playerId : false,
      }));

      let playerRank = null;
      if (playerId) {
        const pe = ranked.find((e) => e.isPlayer);
        if (pe) playerRank = pe.rank;
      }

      this._boards[period] = {
        entries: ranked.slice(0, 100),
        playerRank,
        totalPlayers: sorted.length,
        rewardPool: board.rewardPool || PERIODS[period].rewardPool,
        countdown: {
          remainingMs,
          formatted: formatCountdown(remainingMs),
          ended: remainingMs === 0,
        },
      };
    });
  }

  getBoard(period) {
    return this._boards[period] || { entries: [], playerRank: null, totalPlayers: 0, rewardPool: 0, countdown: { remainingMs: 0, formatted: 'Ended', ended: true } };
  }

  getCountdown(period) {
    const b = this._boards[period];
    return b?.countdown || null;
  }

  _sortEntries(entries) {
    return [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.firstScoreAt || 0) - (b.firstScoreAt || 0);
    });
  }

  _ensurePeriods() {
    const now = Date.now();
    ['daily', 'weekly', 'monthly'].forEach((period) => {
      if (!this._data[period]) {
        this._data[period] = {
          active: true,
          startTime: now,
          endTime: getPeriodEndTime(period),
          entries: [],
        };
      }
    });
    this._save();
  }

  _checkPeriodReset() {
    if (!this._data) return;
    const now = Date.now();
    ['daily', 'weekly', 'monthly'].forEach((period) => {
      const board = this._data[period];
      if (board && board.active && now >= board.endTime) {
        board.active = false;
        this._data[period] = {
          active: true,
          startTime: now,
          endTime: getPeriodEndTime(period),
          entries: [],
        };
      }
    });
    this._save();
  }

  _createDefaults() {
    const now = Date.now();
    return {
      daily: { active: true, startTime: now, endTime: getPeriodEndTime('daily'), entries: [] },
      weekly: { active: true, startTime: now, endTime: getPeriodEndTime('weekly'), entries: [] },
      monthly: { active: true, startTime: now, endTime: getPeriodEndTime('monthly'), entries: [] },
    };
  }

  _save() {
    try { localStorage.setItem(this._storageKey, JSON.stringify(this._data)); } catch {}
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  destroy() {}
}
