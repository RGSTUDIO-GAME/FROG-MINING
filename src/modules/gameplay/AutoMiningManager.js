import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

/**
 * AutoMiningManager — Handles auto mining with API sync.
 */
export class AutoMiningManager {
  constructor(eventBus, gameDataManager, accountManager) {
    this.events = eventBus;
    this.gameDataManager = gameDataManager;
    this.accountManager = accountManager;
    this._intervalId = null;
    this._active = false;
    this._package = null;
    this._startTime = null;
    this._endTime = null;
  }

  async init() {
    const account = this.accountManager?.getAccount();
    if (!account) return;

    // Check server for active mining
    const result = await Api.getAutoMining(account.id);
    if (result.success && result.data.active) {
      this._active = true;
      this._package = this._getPackage(result.data.package);
      this._startTime = result.data.startTime;
      this._endTime = result.data.endTime;
      this._startTimer();
      this.events.emit('autoMining:resume', this.getStatus());
    } else {
      // Check local for offline calculation
      const data = this.gameDataManager.getData();
      if (data?.autoMining?.active && data.autoMining.endTime) {
        const now = Date.now();
        const endTime = new Date(data.autoMining.endTime).getTime();
        if (now < endTime) {
          this._active = true;
          this._package = this._getPackage(data.autoMining.package);
          this._startTime = data.autoMining.startTime;
          this._endTime = data.autoMining.endTime;
          this._startTimer();
          this.events.emit('autoMining:resume', this.getStatus());
        } else {
          this._handleExpired();
        }
      }
    }

    Logger.info('AutoMiningManager', 'Initialized — Active: ' + this._active);
  }

  async activate(packageKey) {
    if (this._active) return { success: false, error: 'Auto Mining is already active' };

    const pkg = this._getPackage(packageKey);
    if (!pkg) return { success: false, error: 'Invalid package' };

    const account = this.accountManager?.getAccount();
    if (!account) return { success: false, error: 'No account' };

    // Activate on server
    const result = await Api.activateAutoMining(account.id, packageKey);
    if (result.success) {
      this._active = true;
      this._package = pkg;
      this._startTime = result.data.startTime;
      this._endTime = result.data.endTime;

      // Sync the authoritative diamond balance from the server response.
      if (typeof result.data?.diamonds === 'number') {
        this.gameDataManager.setDiamonds(result.data.diamonds);
      } else {
        this.gameDataManager.spendDiamonds(pkg.price, 'auto-mining');
      }

      this._saveState();
      this._startTimer();

      this.events.emit('autoMining:activate', {
        package: pkg,
        startTime: this._startTime,
        endTime: this._endTime,
        diamonds: this.gameDataManager.getDiamonds(),
      });

      return { success: true };
    }

    return { success: false, error: result.error || 'Failed to activate' };
  }

  getStatus() {
    if (!this._active) return { active: false };
    const now = Date.now();
    const endTime = new Date(this._endTime).getTime();
    const remainingMs = Math.max(0, endTime - now);
    return {
      active: true,
      package: this._package,
      startTime: this._startTime,
      endTime: this._endTime,
      remainingMs,
      remainingFormatted: this._formatTime(remainingMs),
    };
  }

  _startTimer() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  _tick() {
    if (!this._active) return;
    const now = Date.now();
    const endTime = new Date(this._endTime).getTime();
    if (now >= endTime) { this._handleExpired(); return; }

    this.gameDataManager.addScoreFromAutoMining(Config.AUTO_MINING.SCORE_PER_SECOND);
    const remainingMs = endTime - now;
    this.events.emit('autoMining:tick', {
      remainingMs,
      remainingFormatted: this._formatTime(remainingMs),
      score: this.gameDataManager.getScore(),
    });

    if (Math.floor(now / 10000) !== Math.floor((now - 1000) / 10000)) this._saveState();
  }

  _handleExpired() {
    this._active = false;
    this._package = null;
    this._startTime = null;
    this._endTime = null;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    this._clearState();
    this.events.emit('autoMining:expire', { score: this.gameDataManager.getScore() });
    Logger.info('AutoMining', 'Expired');
  }

  getPackages() {
    return Config.AUTO_MINING.PACKAGES.map((pkg) => ({
      key: pkg.key,
      name: pkg.name,
      icon: pkg.icon,
      price: pkg.price,
      duration: pkg.duration,
      durationFormatted: this._formatTime(pkg.duration * 1000),
      scorePerSecond: Config.AUTO_MINING.SCORE_PER_SECOND,
      totalScore: pkg.duration * Config.AUTO_MINING.SCORE_PER_SECOND,
      badge: pkg.badge,
      color: pkg.color,
    }));
  }

  _getPackage(key) {
    const pkg = Config.AUTO_MINING.PACKAGES.find((p) => p.key === key);
    if (!pkg) return null;
    return { key: pkg.key, name: pkg.name, icon: pkg.icon, price: pkg.price, duration: pkg.duration, badge: pkg.badge, color: pkg.color };
  }

  _formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
  }

  _saveState() {
    const data = this.gameDataManager.getData();
    if (!data) return;
    data.autoMining = { active: this._active, package: this._package?.key || null, startTime: this._startTime, endTime: this._endTime, lastProcessed: new Date().toISOString() };
    const key = Config.STORAGE_KEY + ':gamedata:' + data.playerId;
    localStorage.setItem(key, JSON.stringify(data));
  }

  _clearState() {
    const data = this.gameDataManager.getData();
    if (!data) return;
    data.autoMining = { active: false, package: null, startTime: null, endTime: null };
    const key = Config.STORAGE_KEY + ':gamedata:' + data.playerId;
    localStorage.setItem(key, JSON.stringify(data));
  }

  destroy() {
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
  }
}
