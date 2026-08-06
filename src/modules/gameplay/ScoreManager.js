import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

/**
 * ScoreManager — Core score logic with API sync.
 */
export class ScoreManager {
  constructor(eventBus, gameDataManager, accountManager) {
    this.events = eventBus;
    this.gameDataManager = gameDataManager;
    this.accountManager = accountManager;
    this._lastTapTime = 0;
    this._tapCooldown = 50;
    this._totalTaps = 0;
    this._pendingTaps = 0;
    this._syncInterval = null;
  }

  init() {
    this._totalTaps = this.gameDataManager.getTaps();
    // Sync pending taps every 5 seconds (clear old timer on re-init)
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncInterval = setInterval(() => this._syncPendingTaps(), 5000);
    Logger.info('ScoreManager', 'Initialized — Score: ' + this.gameDataManager.getScore());
  }

  processTap() {
    const now = Date.now();
    if (now - this._lastTapTime < this._tapCooldown) {
      return { success: false, error: 'too_fast' };
    }

    const currentScore = this.gameDataManager.getScore();
    if (currentScore < 0) {
      Logger.warn('ScoreManager', 'Negative score detected, resetting');
      this.gameDataManager.resetScore();
    }

    const amount = Config.SCORE.PER_TAP;
    const success = this.gameDataManager.addScore(amount);

    if (!success) {
      return { success: false, error: 'failed' };
    }

    this._lastTapTime = now;
    this._totalTaps++;
    this._pendingTaps++;

    const newScore = this.gameDataManager.getScore();

    this.events.emit('game:tapProcessed', {
      score: newScore,
      amount,
      tapCount: this._totalTaps,
    });

    return { success: true, score: newScore, amount };
  }

  async _syncPendingTaps() {
    if (this._pendingTaps <= 0) return;

    const account = this.accountManager?.getAccount();
    if (!account) return;

    const tapsToSync = this._pendingTaps;
    this._pendingTaps = 0;

    const result = await Api.submitTap(account.id, tapsToSync);
    if (!result.success) {
      // Re-add pending taps on failure
      this._pendingTaps += tapsToSync;
      Logger.warn('ScoreManager', 'Sync failed, re-queued ' + tapsToSync + ' taps');
    }
  }

  getScore() { return this.gameDataManager.getScore(); }
  getTotalTaps() { return this._totalTaps; }

  getRank() {
    // Real rank comes from the leaderboard (server-synced). This helper is
    // kept only for debug state — a guessed rank would be misleading.
    return '--';
  }

  destroy() {
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncPendingTaps(); // Final sync
  }
}
