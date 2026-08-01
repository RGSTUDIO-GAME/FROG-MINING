import { Logger } from '@utils/logger.js';

/**
 * ProfileScreen — Displays player profile with real data.
 */
export class ProfileScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
  }

  show(container) {
    this.el = document.createElement('div');
    this.el.className = 'screen profile-screen';

    const header = document.createElement('div');
    header.className = 'screen-header';
    header.innerHTML = '<h1>👤 Profile</h1>';

    const content = document.createElement('div');
    content.className = 'screen-content';
    content.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar" id="profile-avatar">🐸</div>
        <div class="profile-name" id="profile-name">Guest</div>
        <div class="profile-id" id="profile-id"></div>
        <div class="profile-joined" id="profile-joined">Joined: --</div>
        <div class="profile-joined" id="profile-login-mode"></div>
      </div>

      <div class="profile-stats">
        <div class="stat-item">
          <div class="stat-value gold" id="profile-score">0</div>
          <div class="stat-label">Total Score</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" id="profile-taps">0</div>
          <div class="stat-label">Total Taps</div>
        </div>
        <div class="stat-item">
          <div class="stat-value crystal" id="profile-diamond">💎 0</div>
          <div class="stat-label">Diamond</div>
        </div>
      </div>

      <div class="profile-best">
        <div class="profile-best-title">🏆 Best Rankings</div>
        <div class="profile-best-item">
          <span>Daily</span><span class="gold">--</span>
        </div>
        <div class="profile-best-item">
          <span>Weekly</span><span class="gold">--</span>
        </div>
        <div class="profile-best-item">
          <span>Monthly</span><span class="gold">--</span>
        </div>
      </div>
    `;

    this.el.appendChild(header);
    this.el.appendChild(content);
    container.appendChild(this.el);
    Logger.debug('ProfileScreen', 'Shown');
  }

  update(data) {
    if (!this.el) return;

    const avatar = this.el.querySelector('#profile-avatar');
    const name = this.el.querySelector('#profile-name');
    const id = this.el.querySelector('#profile-id');
    const joined = this.el.querySelector('#profile-joined');
    const score = this.el.querySelector('#profile-score');
    const taps = this.el.querySelector('#profile-taps');
    const diamond = this.el.querySelector('#profile-diamond');
    const loginMode = this.el.querySelector('#profile-login-mode');

    if (avatar) {
      if (/^https?:\/\//i.test(data.avatar || '')) {
        avatar.innerHTML = `<img class="profile-avatar-img" src="${data.avatar}" alt="" onerror="this.remove()">`;
      } else {
        avatar.textContent = data.avatar || '🐸';
      }
    }
    if (name) name.textContent = data.username || 'Guest';
    if (loginMode) {
      loginMode.textContent = data.loginMode || '';
      loginMode.style.color = data.loginMode && data.loginMode.includes('Telegram') ? '#74C69D' : '#F4845F';
    }
    if (id) id.textContent = data.playerId ? '#' + data.playerId.substring(0, 8) : '';
    if (joined) {
      const date = data.joinDate ? new Date(data.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
      joined.textContent = 'Joined: ' + date;
    }
    if (score) score.textContent = (data.score || 0).toLocaleString();
    if (taps) taps.textContent = (data.taps || 0).toLocaleString();
    if (diamond) diamond.textContent = '💎 ' + (data.diamonds || 0).toLocaleString();
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
