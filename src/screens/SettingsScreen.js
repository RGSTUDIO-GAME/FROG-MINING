import { Logger } from '@utils/logger.js';
import { Config } from '@core/Config.js';

/**
 * SettingsScreen — Settings with background image.
 */
export class SettingsScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
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

    this.el.querySelector('#settings-back').addEventListener('click', () => {
      this.events.emit('nav:change', '/');
    });

    Logger.debug('SettingsScreen', 'Shown');
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
