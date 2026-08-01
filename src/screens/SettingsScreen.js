import { Logger } from '@utils/logger.js';
import { Config } from '@core/Config.js';

/**
 * SettingsScreen — Settings with background image.
 */
export class SettingsScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this.events.on('settings:state', (state) => this._applyState(state));
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
    if (soundToggle) soundToggle.checked = state.sound !== false;
    if (musicToggle) musicToggle.checked = state.music === true;
    const volume = Math.round((typeof state.volume === 'number' ? state.volume : 0.7) * 100);
    if (volumeSlider) volumeSlider.value = volume;
    if (volumeLabel) volumeLabel.textContent = volume + '%';
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
