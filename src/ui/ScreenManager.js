import { Logger } from '@utils/logger.js';

/**
 * ScreenManager — Manages screen switching with transitions.
 */
export class ScreenManager {
  constructor(container, eventBus) {
    this.container = container;
    this.events = eventBus;
    this.screens = new Map();
    this.currentScreen = null;
    this.contentArea = null;
  }

  init() {
    this.contentArea = document.createElement('main');
    this.contentArea.className = 'app-content';
    this.container.appendChild(this.contentArea);

    this.events.on('route:change', ({ to }) => {
      this.showScreen(to.name);
    });

    Logger.info('ScreenManager', 'Initialized');
  }

  register(name, screenInstance) {
    this.screens.set(name, screenInstance);
  }

  getScreen(name) {
    return this.screens.get(name) || null;
  }

  showScreen(name) {
    const screen = this.screens.get(name);
    if (!screen) {
      Logger.warn('ScreenManager', `Screen not found: ${name}`);
      return;
    }

    // Hide current
    if (this.currentScreen) {
      this.currentScreen.hide();
    }

    // Show new
    this.currentScreen = screen;
    this.contentArea.innerHTML = '';
    screen.show(this.contentArea);

    Logger.debug('ScreenManager', `Showing: ${name}`);
  }

  destroy() {
    this.screens.forEach((s) => s.destroy?.());
    this.screens.clear();
  }
}
