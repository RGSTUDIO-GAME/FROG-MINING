import { Logger } from '@utils/logger.js';

/**
 * LeaderboardScreen — Full leaderboard with tabs, countdown, and player position.
 */
export class LeaderboardScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this._activeTab = 'daily';
    this._countdownInterval = null;
    this._boardData = { daily: null, weekly: null, monthly: null };
  }

  show(container) {
    this.el = document.createElement('div');
    this.el.className = 'screen leaderboard-screen';

    const header = document.createElement('div');
    header.className = 'screen-header';
    header.innerHTML = '<h1>🏆 Leaderboard</h1>';

    const content = document.createElement('div');
    content.className = 'screen-content';

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'board-tabs';
    ['daily', 'weekly', 'monthly'].forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = 'board-tab' + (tab === this._activeTab ? ' active' : '');
      btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      btn.dataset.tab = tab;
      btn.addEventListener('click', () => {
        this._activeTab = tab;
        tabs.querySelectorAll('.board-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderBoard();
      });
      tabs.appendChild(btn);
    });

    // Period info
    const periodInfo = document.createElement('div');
    periodInfo.className = 'board-period-info';
    periodInfo.innerHTML = `
      <div class="board-countdown" id="board-countdown">⏱️ --:--</div>
      <div class="board-reward-pool" id="board-reward-pool">💎 Pool: --</div>
    `;

    // Board list
    const listEl = document.createElement('div');
    listEl.className = 'board-list';
    listEl.id = 'board-list';

    // Player position
    const playerPos = document.createElement('div');
    playerPos.className = 'board-player-position';
    playerPos.id = 'board-player-position';
    playerPos.innerHTML = '<div class="board-player-loading">Loading your position...</div>';

    content.appendChild(tabs);
    content.appendChild(periodInfo);
    content.appendChild(listEl);
    content.appendChild(playerPos);

    this.el.appendChild(header);
    this.el.appendChild(content);
    container.appendChild(this.el);

    // Start countdown timer
    this._startCountdown();

    Logger.debug('LeaderboardScreen', 'Shown');
  }

  /**
   * Update board data from LeaderboardManager.
   */
  updateBoard(data) {
    // data = { period, board: { entries, playerRank, totalPlayers, rewardPool, countdown } }
    this._boardData[data.period] = data;
    if (data.period === this._activeTab) {
      this._renderBoard();
    }
  }

  _renderBoard() {
    const data = this._boardData[this._activeTab];
    const listEl = this.el?.querySelector('#board-list');
    const countdownEl = this.el?.querySelector('#board-countdown');
    const poolEl = this.el?.querySelector('#board-reward-pool');
    const playerPosEl = this.el?.querySelector('#board-player-position');

    if (!listEl) return;

    if (!data || !data.board) {
      listEl.innerHTML = '<div class="board-empty">No data available</div>';
      return;
    }

    const { entries, playerRank, totalPlayers, rewardPool, countdown } = data.board;

    // Update countdown
    if (countdownEl && countdown) {
      countdownEl.textContent = '⏱️ ' + countdown.formatted;
    }

    // Update reward pool
    if (poolEl) {
      poolEl.textContent = '💎 Pool: ' + (rewardPool || 0).toLocaleString() + ' Diamond';
    }

    // Render entries
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="board-empty">No players yet. Be the first!</div>';
    } else {
      listEl.innerHTML = entries.map((entry) => {
        const rankIcon = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : '#' + entry.rank;
        const avatarHtml = /^https?:\/\//i.test(entry.avatar || '')
          ? `<img class="board-avatar-img" src="${entry.avatar}" alt="" loading="lazy" onerror="this.remove()">`
          : (entry.avatar || '🐸');
        return `
          <div class="board-item${entry.rank <= 3 ? ' rank-' + entry.rank : ''}${entry.isPlayer ? ' is-player' : ''}">
            <span class="board-rank">${rankIcon}</span>
            <span class="board-avatar">${avatarHtml}</span>
            <span class="board-name">${entry.username}</span>
            <span class="board-score">${entry.score.toLocaleString()}</span>
          </div>
        `;
      }).join('');
    }

    // Player position
    if (playerPosEl) {
      if (playerRank) {
        playerPosEl.innerHTML = '<div class="board-player-pos">📍 Your position: #' + playerRank + ' of ' + totalPlayers + '</div>';
      } else if (totalPlayers > 0) {
        playerPosEl.innerHTML = '<div class="board-player-pos">📍 Not ranked yet — start tapping!</div>';
      } else {
        playerPosEl.innerHTML = '<div class="board-player-pos">📍 Be the first to play!</div>';
      }
    }
  }

  _startCountdown() {
    this._countdownInterval = setInterval(() => {
      this.events.emit('leaderboard:requestUpdate');
    }, 10000); // Update every 10 seconds
  }

  hide() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
    this.el?.remove();
  }

  destroy() {
    this.hide();
  }
}
