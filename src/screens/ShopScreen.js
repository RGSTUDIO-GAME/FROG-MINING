import { Logger } from '@utils/logger.js';
import { Config } from '@core/Config.js';
import { createButton } from '@ui/components/Button.js';

/**
 * ShopScreen — Two-tab shop: Diamond packages + Auto Mining packages.
 */
export class ShopScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this._activeTab = 'diamond';
    this._miningPackages = [];
    this._canAffordFn = null;
    this._onMiningSelect = null;
  }

  show(container) {
    this.el = document.createElement('div');
    this.el.className = 'screen shop-screen';
    this._render();
    container.appendChild(this.el);
    Logger.debug('ShopScreen', 'Shown');
  }

  _render() {
    this.el.innerHTML = `
      <div class="screen-header">
        <h1>🛒 Shop</h1>
        <div class="shop-balance">💎 <span id="shop-diamond">0</span></div>
      </div>

      <div class="shop-tabs">
        <button class="shop-tab active" data-tab="diamond">💎 Diamond</button>
        <button class="shop-tab" data-tab="mining">⛏️ Auto Mining</button>
      </div>

      <div class="screen-content">
        <div class="shop-tab-content" id="tab-diamond"></div>
        <div class="shop-tab-content hidden" id="tab-mining"></div>
      </div>
    `;

    this._renderDiamondTab();
    this._renderMiningTab();
    this._bindTabs();
  }

  _renderDiamondTab() {
    const container = this.el.querySelector('#tab-diamond');
    const packages = Config.SHOP.DIAMOND_PACKAGES;

    container.innerHTML = packages.map((pkg) => `
      <div class="shop-item ${pkg.popular ? 'popular' : ''}">
        ${pkg.popular ? '<div class="shop-badge">BEST VALUE</div>' : ''}
        <div class="shop-item-left">
          <div class="shop-item-icon">${pkg.icon}</div>
          <div class="shop-item-info">
            <div class="shop-item-name">${pkg.name}</div>
            <div class="shop-item-desc">${pkg.diamond.toLocaleString()} Diamond${pkg.bonus > 0 ? ' <span class="shop-bonus">+' + pkg.bonus + ' bonus</span>' : ''}</div>
          </div>
        </div>
        <div class="shop-item-right">
          <div class="shop-item-price">${pkg.price}</div>
          <button class="btn btn-sm ${pkg.popular ? 'btn-gold' : 'btn-primary'}" data-product="${pkg.id}">Beli</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-product]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.emit('shop:buy', { productId: btn.dataset.product });
      });
    });
  }

  _renderMiningTab() {
    this._updateMiningTab();
  }

  _updateMiningTab() {
    const container = this.el?.querySelector('#tab-mining');
    if (!container) return;

    if (this._miningPackages.length === 0) {
      container.innerHTML = '<div class="shop-empty">Loading packages...</div>';
      return;
    }

    container.innerHTML = this._miningPackages.map((pkg) => {
      const affordable = this._canAffordFn ? this._canAffordFn(pkg.price) : false;
      return `
        <div class="shop-item mining-item ${!affordable ? 'disabled' : ''} ${pkg.badge ? 'has-badge' : ''}" style="--pkg-color: ${pkg.color}">
          ${pkg.badge ? '<div class="shop-badge" style="background:' + pkg.color + '">' + pkg.badge + '</div>' : ''}
          <div class="shop-item-left">
            <div class="shop-item-icon mining-icon">${pkg.icon}</div>
            <div class="shop-item-info">
              <div class="shop-item-name">${pkg.name}</div>
              <div class="shop-item-desc">
                ⏱️ ${pkg.durationFormatted} · +${pkg.totalScore.toLocaleString()} score
              </div>
            </div>
          </div>
          <div class="shop-item-right">
            <div class="shop-item-price mining-price">💎 ${pkg.price.toLocaleString()}</div>
            <button class="btn btn-sm ${affordable ? 'btn-primary' : 'btn-disabled'}" data-mining="${pkg.key}" ${!affordable ? 'disabled' : ''}>
              ${affordable ? 'Activate' : 'Need 💎'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-mining]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.mining;
        if (this._onMiningSelect && !btn.disabled) this._onMiningSelect(key);
      });
    });
  }

  _bindTabs() {
    this.el.querySelectorAll('.shop-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this.el.querySelectorAll('.shop-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.el.querySelectorAll('.shop-tab-content').forEach((c) => c.classList.add('hidden'));
        this.el.querySelector('#tab-' + this._activeTab).classList.remove('hidden');
      });
    });
  }

  updateDiamonds(count) {
    const el = this.el?.querySelector('#shop-diamond');
    if (el) el.textContent = count.toLocaleString();
  }

  setMiningData(packages, canAffordFn, onSelectFn) {
    this._miningPackages = packages;
    this._canAffordFn = canAffordFn;
    this._onMiningSelect = onSelectFn;
    this._updateMiningTab();
  }

  showMiningActive(status) {
    const container = this.el?.querySelector('#tab-mining');
    if (!container) return;
    const pkg = status.package || {};
    container.innerHTML = `
      <div class="mining-active-card">
        <div class="mining-active-icon">${pkg.icon || '⛏️'}</div>
        <div class="mining-active-title">${pkg.name || 'Auto Mining'} Aktif</div>
        <div class="mining-active-sub">Auto Mining sedang berjalan. Paket baru bisa dibeli setelah selesai.</div>
        <div class="mining-active-timer" id="shop-mining-timer">${status.remainingFormatted || '--:--'}</div>
      </div>
    `;
  }

  updateMiningTick(remainingFormatted) {
    const timer = this.el?.querySelector('#shop-mining-timer');
    if (timer && remainingFormatted) timer.textContent = remainingFormatted;
  }

  hide() { this.el?.remove(); }
  destroy() { this.el?.remove(); }
}
