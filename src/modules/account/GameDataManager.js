import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

/**
 * GameDataManager — Manages player game data with API sync.
 */
export class GameDataManager {
  constructor(eventBus, accountManager) {
    this.events = eventBus;
    this.accountManager = accountManager;
    this._storageKey = Config.STORAGE_KEY + ':gamedata';
    this._data = null;
  }

  async init() {
    const account = this.accountManager.getAccount();
    if (!account) {
      Logger.warn('GameDataManager', 'No account found');
      return;
    }

    // Load local cache first
    this._data = this._load(account.id) || this._createDefault(account.id);

    // Sync with server
    await this._syncFromServer(account.id);

    Logger.info('GameDataManager', 'Loaded data for: ' + account.username);
    this.events.emit('gamedata:init', this._data);
  }

  async _syncFromServer(playerId) {
    // Fetch score from server
    const scoreResult = await Api.getScore(playerId);
    if (scoreResult.success) {
      this._data.score = scoreResult.data.score;
    }

    // Fetch diamonds from server
    const diamondResult = await Api.getDiamonds(playerId);
    if (diamondResult.success) {
      this._data.diamonds = diamondResult.data.diamonds;
    }

    // Fetch auto mining status
    const miningResult = await Api.getAutoMining(playerId);
    if (miningResult.success && miningResult.data.active) {
      this._data.autoMining = {
        active: true,
        package: miningResult.data.package,
        startTime: miningResult.data.startTime,
        endTime: miningResult.data.endTime,
      };
      // Update score from mining
      this._data.score = miningResult.data.currentScore;
    }

    this._save();
  }

  getData() { return this._data ? { ...this._data } : null; }
  getScore() { return this._data?.score || 0; }
  getDiamonds() { return this._data?.diamonds || 0; }
  getTaps() { return this._data?.totalTaps || 0; }

  addScore(amount = 1) {
    if (!this._data || amount <= 0) return false;
    this._data.score += amount;
    this._data.totalTaps += amount;
    this._save();
    this.events.emit('gamedata:scoreChange', { score: this._data.score, amount, source: 'tap' });
    return true;
  }

  addScoreFromAutoMining(amount = 1) {
    if (!this._data || amount <= 0) return false;
    this._data.score += amount;
    this._save();
    this.events.emit('gamedata:scoreChange', { score: this._data.score, amount, source: 'auto' });
    return true;
  }

  setScore(score) {
    if (!this._data || typeof score !== 'number' || score < 0) return false;
    this._data.score = Math.floor(score);
    this._save();
    this.events.emit('gamedata:scoreChange', { score: this._data.score, source: 'sync' });
    return true;
  }

  setDiamonds(diamonds) {
    if (!this._data || typeof diamonds !== 'number' || diamonds < 0) return false;
    this._data.diamonds = Math.floor(diamonds);
    this._save();
    this.events.emit('gamedata:diamondChange', { diamonds: this._data.diamonds, source: 'sync' });
    return true;
  }

  addDiamonds(amount, source = 'unknown') {
    if (!this._data || amount <= 0) return false;
    this._data.diamonds += amount;
    this._save();
    this.events.emit('gamedata:diamondChange', { diamonds: this._data.diamonds, amount, source });
    return true;
  }

  spendDiamonds(amount, purpose = 'unknown') {
    if (!this._data || amount <= 0 || this._data.diamonds < amount) return false;
    this._data.diamonds -= amount;
    this._save();
    this.events.emit('gamedata:diamondChange', { diamonds: this._data.diamonds, amount: -amount, source: purpose });
    return true;
  }

  canAfford(cost) { return this._data ? this._data.diamonds >= cost : false; }

  resetScore() {
    if (!this._data) return;
    this._data.score = 0;
    this._save();
    this.events.emit('gamedata:scoreReset');
  }

  _createDefault(playerId) {
    const d = {
      playerId, score: 0, diamonds: 0, totalTaps: 0,
      autoMining: { active: false, package: null, startTime: null, endTime: null },
      createdAt: new Date().toISOString(),
    };
    this._save(d);
    return d;
  }

  _save(data) {
    if (!this._data && !data) return;
    const toSave = data || this._data;
    const key = this._storageKey + ':' + toSave.playerId;
    localStorage.setItem(key, JSON.stringify(toSave));
  }

  _load(playerId) {
    try {
      const key = this._storageKey + ':' + playerId;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
