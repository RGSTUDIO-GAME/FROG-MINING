import { Logger } from '@utils/logger.js';
import { createModal } from '@ui/components/Modal.js';

const LOGO_SRC = `${import.meta.env.BASE_URL}assets/frog-runner/logo.png`;

/**
 * HomeScreen — Main gameplay screen with frog, score, and auto mining.
 */
export class HomeScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this._tapEnabled = true;
    this._lastTap = 0;
    this._diamonds = 0;
    this._inventoryModal = null;
  }

  show(container) {
    this.el = document.createElement('div');
    this.el.className = 'screen home-screen';
    this.el.innerHTML = `
      <div class="home-top">
        <div class="home-stat">
          <div class="home-stat-value gold" id="home-score">0</div>
          <div class="home-stat-label">SCORE</div>
        </div>
        <div class="home-stat">
          <button class="home-inventory-btn" id="home-inventory-btn" type="button" aria-label="Buka Inventory">
            <span class="home-inventory-icon">🎒</span>
            <span class="home-inventory-label">INVENTORY</span>
          </button>
        </div>
      </div>

      <div class="home-center">
        <div class="frog-container" id="frog-container">
          <div class="frog-ring frog-ring-1"></div>
          <div class="frog-ring frog-ring-2"></div>
          <div class="frog-glow" id="frog-glow"></div>
          <div class="frog-head" id="frog-head"><img src="${import.meta.env.BASE_URL}assets/images/frog-tap.png" alt="Frog" class="frog-img" draggable="false" /></div>
          <div class="frog-shadow"></div>
        </div>
      </div>

      <div class="home-bottom">
        <div class="mining-status hidden" id="mining-status">
          <div class="mining-status-header">
            <span class="mining-status-icon">⛏️</span>
            <span class="mining-status-title" id="mining-pkg-name">Auto Mining Active</span>
          </div>
          <div class="mining-status-timer" id="mining-timer">--:--:--</div>
          <div class="mining-progress">
            <div class="mining-fill" id="mining-fill"></div>
          </div>
          <div class="mining-status-score">+1/sec • <span id="mining-total">0</span> score earned</div>
        </div>

        <div class="mining-activate" id="mining-activate">
          <div class="mining-activate-title">⛏️ Auto Mining</div>
          <div class="mining-activate-subtitle">Earn score while you sleep!</div>
          <div class="mining-packages" id="mining-packages"></div>
        </div>

        <button class="runner-play-btn" id="runner-play" type="button">
          <span class="runner-play-icon"><img class="runner-play-icon-img" src="${LOGO_SRC}" alt="Katak" draggable="false" /></span>
          <span class="runner-play-text">
            <span class="runner-play-title">PLAY GAME</span>
            <span class="runner-play-sub">Frog Runner Mini-Game</span>
          </span>
          <span class="runner-play-arrow">▶</span>
        </button>
      </div>
    `;
    container.appendChild(this.el);

    const frog = this.el.querySelector('#frog-head');
    frog.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._handleTap();
    });
    frog.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._handleTap();
    }, { passive: false });

    const playBtn = this.el.querySelector('#runner-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.events.emit('game:runnerPlay'));
    }

    const inventoryBtn = this.el.querySelector('#home-inventory-btn');
    if (inventoryBtn) {
      inventoryBtn.addEventListener('click', () => this.openInventory());
    }

    Logger.debug('HomeScreen', 'Shown');
  }

  _handleTap() {
    if (!this._tapEnabled) return;
    const now = Date.now();
    if (now - this._lastTap < 30) return;
    this._lastTap = now;

    this.events.emit('game:tap');
    this._animateFrog();
    this._animateFloatingPlus();
    this._animateGlow();
    this._spawnParticles();
  }

  _animateFrog() {
    const frog = this.el?.querySelector('#frog-head');
    if (!frog) return;
    frog.classList.remove('frog-tap');
    void frog.offsetWidth;
    frog.classList.add('frog-tap');
    setTimeout(() => frog.classList.remove('frog-tap'), 300);
  }

  _animateFloatingPlus() {
    const container = this.el?.querySelector('#frog-container');
    if (!container) return;
    const float = document.createElement('div');
    float.className = 'floating-plus';
    float.textContent = '+1';
    float.style.left = 'calc(50% + ' + (Math.random() * 40 - 20) + 'px)';
    container.appendChild(float);
    setTimeout(() => float.remove(), 800);
  }

  _animateGlow() {
    const glow = this.el?.querySelector('#frog-glow');
    if (!glow) return;
    glow.classList.remove('glow-pulse');
    void glow.offsetWidth;
    glow.classList.add('glow-pulse');
    setTimeout(() => glow.classList.remove('glow-pulse'), 300);
  }

  _spawnParticles() {
    const container = this.el?.querySelector('#frog-container');
    if (!container) return;
    const colors = ['#F0C040', '#48BFE3', '#74C69D', '#F4845F', '#7B68EE'];
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      p.className = 'frog-particle';
      const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 30;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.background = colors[i % colors.length];
      container.appendChild(p);
      setTimeout(() => p.remove(), 500);
    }
  }

  updateScore(score) {
    const el = this.el?.querySelector('#home-score');
    if (!el) return;
    const old = parseInt(el.textContent.replace(/,/g, '')) || 0;
    el.textContent = score.toLocaleString();
    if (score !== old) {
      el.classList.remove('score-pulse');
      void el.offsetWidth;
      el.classList.add('score-pulse');
      setTimeout(() => el.classList.remove('score-pulse'), 200);
    }
  }

  updateDiamonds(count) {
    this._diamonds = count;
    if (this._inventoryModal) {
      const body = this._inventoryModal.el.querySelector('.modal-body');
      if (body) {
        body.innerHTML = '';
        body.appendChild(this._renderInventoryContent());
      }
    }
  }

  openInventory() {
    if (this._inventoryModal) return;
    const modal = createModal({
      title: '🎒 Inventory',
      content: this._renderInventoryContent(),
      onClose: () => {
        this._inventoryModal = null;
      },
    });
    this._inventoryModal = modal;
  }

  _inventoryItems() {
    return [
      { id: 'diamond', name: 'Diamond', icon: '💎', count: this._diamonds },
    ];
  }

  _renderInventoryContent() {
    const wrap = document.createElement('div');
    const items = this._inventoryItems();
    wrap.innerHTML = `
      <div class="inventory-grid">
        ${items.map((item) => `
          <div class="inventory-item">
            <div class="inventory-item-icon">${item.icon}</div>
            <div class="inventory-item-name">${item.name}</div>
            <div class="inventory-item-count">x ${item.count.toLocaleString()}</div>
          </div>`).join('')}
      </div>
      <p class="inventory-hint">Item baru akan muncul di sini pada pembaruan berikutnya.</p>
    `;
    return wrap;
  }

  showMiningPackages(packages, canAfford, onSelect) {
    const container = this.el?.querySelector('#mining-packages');
    const activate = this.el?.querySelector('#mining-activate');
    const status = this.el?.querySelector('#mining-status');
    if (!container || !activate || !status) return;

    activate.classList.remove('hidden');
    status.classList.add('hidden');

    container.innerHTML = packages.map((pkg) => `
      <div class="mining-row ${!canAfford(pkg.key) ? 'disabled' : ''}" data-package="${pkg.key}">
        <div class="mining-row-left">
          <span class="mining-row-icon">${pkg.icon}</span>
          <div class="mining-row-info">
            <span class="mining-row-name">${pkg.name}</span>
            <span class="mining-row-detail">⏱️ ${pkg.durationFormatted} · +${pkg.totalScore.toLocaleString()}</span>
          </div>
        </div>
        <div class="mining-row-right">
          <span class="mining-row-price">💎 ${pkg.price.toLocaleString()}</span>
          <button class="btn btn-xs ${canAfford(pkg.key) ? 'btn-primary' : 'btn-disabled'}" ${!canAfford(pkg.key) ? 'disabled' : ''}>
            ${canAfford(pkg.key) ? 'Go' : 'Need 💎'}
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.mining-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        const key = row.dataset.package;
        const btn = row.querySelector('button');
        if (btn && !btn.disabled && onSelect) onSelect(key);
      });
    });
  }

  showMiningActive(status) {
    const activate = this.el?.querySelector('#mining-activate');
    const statusEl = this.el?.querySelector('#mining-status');
    if (!activate || !statusEl) return;
    activate.classList.add('hidden');
    statusEl.classList.remove('hidden');

    const nameEl = this.el?.querySelector('#mining-pkg-name');
    if (nameEl && status.package) {
      nameEl.textContent = (status.package.icon || '⛏️') + ' ' + (status.package.name || 'Auto Mining') + ' Active';
    }
    if (status.startTime && status.endTime) {
      this._miningTotalMs = Math.max(1, new Date(status.endTime).getTime() - new Date(status.startTime).getTime());
    }
    this._updateMiningTimer(status.remainingMs, status.remainingFormatted);
  }

  updateMiningTick(remainingMs, remainingFormatted) {
    this._updateMiningTimer(remainingMs, remainingFormatted);
  }

  _updateMiningTimer(remainingMs, formatted) {
    const timer = this.el?.querySelector('#mining-timer');
    const fill = this.el?.querySelector('#mining-fill');
    if (timer) timer.textContent = formatted;
    if (fill) {
      const totalMs = this._miningTotalMs || 1;
      const pct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));
      fill.style.width = pct + '%';
    }
  }

  updateMiningTotalScore(score) {
    const el = this.el?.querySelector('#mining-total');
    if (el) el.textContent = score.toLocaleString();
  }

  hideMiningActive() {
    const activate = this.el?.querySelector('#mining-activate');
    const status = this.el?.querySelector('#mining-status');
    if (activate) activate.classList.remove('hidden');
    if (status) status.classList.add('hidden');
  }

  setTapEnabled(enabled) { this._tapEnabled = enabled; }
  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
