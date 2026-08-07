import { Logger } from '@utils/logger.js';
import { Config } from '@core/Config.js';

/**
 * SettingsScreen — Settings with background image.
 */
export class SettingsScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this._inviteUrl = '';
    this.events.on('settings:state', (state) => this._applyState(state));
    this.events.on('settings:referral', (data) => this._applyReferral(data));
  }

  show(container) {
    this.el = document.createElement('div');
    this.el.className = 'screen settings-screen';

    this.el.innerHTML = `
      <div class="settings-header">
        <div class="settings-header-left">
          <span class="settings-back" id="settings-back">‹</span>
        </div>
        <h1 class="settings-title">Pengaturan</h1>
        <div class="settings-header-right"></div>
      </div>

      <div class="settings-content">
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">🔊</span>
              <span class="settings-row-label">Suara</span>
            </div>
            <label class="toggle">
              <input type="checkbox" checked id="toggle-sound">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">🎵</span>
              <span class="settings-row-label">Musik</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="toggle-music">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row settings-volume-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">🔉</span>
              <span class="settings-row-label">Volume Musik</span>
            </div>
            <div class="settings-volume-control">
              <input type="range" id="music-volume" min="0" max="100" value="70">
              <span class="settings-volume-value" id="music-volume-label">70%</span>
            </div>
          </div>

          <div class="settings-row settings-volume-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">🔊</span>
              <span class="settings-row-label">Volume Suara</span>
            </div>
            <div class="settings-volume-control">
              <input type="range" id="sound-volume" min="0" max="100" value="70">
              <span class="settings-volume-value" id="sound-volume-label">70%</span>
            </div>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-referral">
            <div class="settings-referral-header">
              <span class="settings-row-icon">👥</span>
              <span class="settings-referral-title">Undang Teman</span>
            </div>
            <div class="settings-referral-desc">
              🎁 500 Diamond untuk setiap teman yang bergabung.<br>
              💎 Bonus 5% dari Diamond temanmu.<br>
              🎉 Temanmu mendapat 200 Diamond sebagai bonus.
            </div>
            <div class="settings-referral-link" id="referral-link">Memuat link...</div>
            <div class="settings-referral-actions">
              <button class="btn-referral" id="referral-copy">📋 Salin</button>
              <button class="btn-referral" id="referral-share">📤 Bagikan</button>
            </div>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">🌐</span>
              <span class="settings-row-label">Bahasa</span>
            </div>
            <div class="settings-row-right">
              <span class="settings-row-value">Indonesia</span>
              <span class="settings-row-arrow">›</span>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-row-left">
              <span class="settings-row-icon">📋</span>
              <span class="settings-row-label">Versi</span>
            </div>
            <span class="settings-row-value">${Config.APP.VERSION}</span>
          </div>
        </div>

      </div>
    `;

    container.appendChild(this.el);

    this.el.querySelector('#toggle-sound').addEventListener('change', (e) => {
      this.events.emit('settings:soundToggle', e.target.checked);
    });

    this.el.querySelector('#toggle-music').addEventListener('change', (e) => {
      this.events.emit('settings:musicToggle', e.target.checked);
    });

    this.el.querySelector('#music-volume').addEventListener('input', (e) => {
      const value = Number(e.target.value) / 100;
      const label = this.el.querySelector('#music-volume-label');
      if (label) label.textContent = e.target.value + '%';
      this.events.emit('settings:musicVolume', value);
    });

    this.el.querySelector('#sound-volume').addEventListener('input', (e) => {
      const value = Number(e.target.value) / 100;
      const label = this.el.querySelector('#sound-volume-label');
      if (label) label.textContent = e.target.value + '%';
      this.events.emit('settings:soundVolume', value);
    });

    this.el.querySelector('#referral-copy').addEventListener('click', () => this._copyInvite());
    this.el.querySelector('#referral-share').addEventListener('click', () => this._shareInvite());

    this.el.querySelector('#settings-back').addEventListener('click', () => {
      this.events.emit('nav:change', '/');
    });

    this.events.emit('settings:stateRequest');

    Logger.debug('SettingsScreen', 'Shown');
  }

  _applyState(state) {
    if (!this.el || !state) return;
    const soundToggle = this.el.querySelector('#toggle-sound');
    const musicToggle = this.el.querySelector('#toggle-music');
    const volumeSlider = this.el.querySelector('#music-volume');
    const volumeLabel = this.el.querySelector('#music-volume-label');
    const soundVolumeSlider = this.el.querySelector('#sound-volume');
    const soundVolumeLabel = this.el.querySelector('#sound-volume-label');
    if (soundToggle) soundToggle.checked = state.sound !== false;
    if (musicToggle) musicToggle.checked = state.music === true;
    const volume = Math.round((typeof state.volume === 'number' ? state.volume : 0.7) * 100);
    if (volumeSlider) volumeSlider.value = volume;
    if (volumeLabel) volumeLabel.textContent = volume + '%';
    const soundVolume = Math.round((typeof state.soundVolume === 'number' ? state.soundVolume : 0.7) * 100);
    if (soundVolumeSlider) soundVolumeSlider.value = soundVolume;
    if (soundVolumeLabel) soundVolumeLabel.textContent = soundVolume + '%';
  }

  _applyReferral(data) {
    if (!this.el || !data) return;
    this._inviteUrl = data.inviteUrl || '';
    const linkEl = this.el.querySelector('#referral-link');
    if (linkEl && this._inviteUrl) linkEl.textContent = this._inviteUrl;
  }

  _copyInvite() {
    const linkEl = this.el.querySelector('#referral-link');
    if (!this._inviteUrl) return;
    const done = () => {
      if (linkEl) linkEl.textContent = '✅ Link tersalin!';
      setTimeout(() => {
        if (linkEl && this._inviteUrl) linkEl.textContent = this._inviteUrl;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this._inviteUrl).then(done).catch(() => this._fallbackCopy(done));
    } else {
      this._fallbackCopy(done);
    }
  }

  _fallbackCopy(done) {
    const input = document.createElement('input');
    input.value = this._inviteUrl;
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(input);
    done();
  }

  _shareInvite() {
    if (!this._inviteUrl) return;
    // Di Telegram — buka share picker Telegram langsung
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(this._inviteUrl) +
          '&text=' + encodeURIComponent('Main Bareng di Frogmining dan Ambil Bonus 500 Diamond');
        window.Telegram.WebApp.openTelegramLink(shareUrl);
        return;
      }
    } catch (e) { /* fallback di bawah */ }
    if (navigator.share) {
      navigator.share({
        title: 'Frog Mining',
        text: 'Main yuk di Frog Mining! Ajak aku dan dapatkan 500 Diamond + komisi 5%. Teman dapat 200 Diamond 🐸⛏️',
        url: this._inviteUrl,
      }).catch(() => { /* dibatalkan */ });
    } else {
      this._copyInvite();
    }
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
