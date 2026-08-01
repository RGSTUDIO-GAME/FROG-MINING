import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

/**
 * ProfileScreen — Displays player profile with real data.
 */
export class ProfileScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this._playerId = null;
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
        <button class="profile-avatar-btn" id="profile-avatar-btn">📷 Ganti Foto</button>
        <input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/webp" hidden>
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
        <div class="stat-item">
          <div class="stat-value" id="profile-referrals">0</div>
          <div class="stat-label">👥 Undangan</div>
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

    this.el.querySelector('#profile-avatar-btn').addEventListener('click', () => {
      this.el.querySelector('#profile-avatar-input').click();
    });
    this.el.querySelector('#profile-avatar-input').addEventListener('change', (e) => {
      this._handleAvatarFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });

    Logger.debug('ProfileScreen', 'Shown');
  }

  _handleAvatarFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      this.events.emit('profile:avatarError', 'Format foto harus PNG/JPG/WebP');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.events.emit('profile:avatarError', 'Foto terlalu besar (maks 3 MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this._resizeAvatar(reader.result);
    reader.onerror = () => this.events.emit('profile:avatarError', 'Gagal membaca foto');
    reader.readAsDataURL(file);
  }

  _resizeAvatar(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const ratio = Math.max(size / img.width, size / img.height);
      const w = size / ratio;
      const h = size / ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      this._uploadAvatar(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => this.events.emit('profile:avatarError', 'Gagal memproses foto');
    img.src = dataUrl;
  }

  async _uploadAvatar(dataUrl) {
    if (!this._playerId) {
      this.events.emit('profile:avatarError', 'Akun belum siap, coba lagi nanti');
      return;
    }
    const res = await Api.uploadAvatar(this._playerId, dataUrl);
    if (res.success && res.data && res.data.avatar) {
      this.events.emit('profile:avatarChanged', res.data.avatar);
    } else {
      this.events.emit('profile:avatarError', res.error || 'Gagal mengubah foto');
    }
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
    const referrals = this.el.querySelector('#profile-referrals');
    const loginMode = this.el.querySelector('#profile-login-mode');

    if (avatar) {
      if (/^(\/|https?:\/\/)/i.test(data.avatar || '')) {
        avatar.innerHTML = `<img class="profile-avatar-img" src="${data.avatar}" alt="" onerror="this.remove()">`;
      } else {
        avatar.textContent = data.avatar || '🐸';
      }
    }
    this._playerId = data.playerId || this._playerId;
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
    if (referrals) referrals.textContent = (data.invitedCount || 0).toLocaleString();
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
