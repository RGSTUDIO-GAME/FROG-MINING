import { Game } from '@core/Game.js';
import { Logger } from '@utils/logger.js';

/**
 * Frog Mining — Entry Point
 */
function bootstrap() {
  const game = new Game();
  game.init();

  if (import.meta.env.DEV) {
    window.__game = game;
    Logger.info('Dev', 'Debug tools available at window.__game');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
