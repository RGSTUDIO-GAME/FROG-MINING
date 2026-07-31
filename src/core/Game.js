import { EventBus } from './EventBus.js';
import { Router } from './Router.js';
import { Config } from './Config.js';
import { Logger } from '@utils/logger.js';

import { AccountManager } from '@modules/account/AccountManager.js';
import { GameDataManager } from '@modules/account/GameDataManager.js';
import { ScoreManager } from '@modules/gameplay/ScoreManager.js';
import { AutoMiningManager } from '@modules/gameplay/AutoMiningManager.js';
import { SoundManager } from '@modules/gameplay/SoundManager.js';
import { LeaderboardManager } from '@modules/leaderboard/LeaderboardManager.js';
import { MailManager } from '@modules/mail/MailManager.js';
import { checkAndSendGifts } from '@modules/mail/AdminGift.js';

import { Header } from '@ui/layout/Header.js';
import { BottomNav } from '@ui/layout/BottomNav.js';
import { ScreenManager } from '@ui/ScreenManager.js';
import { showPopup } from '@ui/components/Popup.js';

import { SplashScreen } from '@screens/SplashScreen.js';
import { HomeScreen } from '@screens/HomeScreen.js';
import { ShopScreen } from '@screens/ShopScreen.js';
import { LeaderboardScreen } from '@screens/LeaderboardScreen.js';
import { MailScreen } from '@screens/MailScreen.js';
import { ProfileScreen } from '@screens/ProfileScreen.js';
import { SettingsScreen } from '@screens/SettingsScreen.js';

/**
 * Game — Core game controller with all systems.
 */
export class Game {
  constructor() {
    this.events = new EventBus();
    this.router = new Router(this.events);
    this.config = Config;

    this.accountManager = new AccountManager(this.events);
    this.gameDataManager = new GameDataManager(this.events, this.accountManager);
    this.scoreManager = new ScoreManager(this.events, this.gameDataManager, this.accountManager);
    this.autoMiningManager = new AutoMiningManager(this.events, this.gameDataManager, this.accountManager);
    this.soundManager = new SoundManager(this.events);
    this.leaderboardManager = new LeaderboardManager(this.events, this.gameDataManager, this.accountManager);
    this.mailManager = new MailManager(this.events, this.gameDataManager, this.accountManager);

    this.header = null;
    this.bottomNav = null;
    this.screenManager = null;
    this._running = false;
    this._account = null;
  }

  init() {
    Logger.info('Game', 'Initializing ' + this.config.APP.NAME + ' v' + this.config.APP.VERSION);
    const app = document.getElementById('app');
    app.innerHTML = '';

    const splash = new SplashScreen(this.events);
    this.events.on('splash:complete', () => this._checkAndRoute(app));

    splash.show(app);
    this._running = true;
    return this;
  }

  async _checkAndRoute(app) {
    try {
      const result = await this.accountManager.autoLogin();
      if (result && result.account) {
        this._account = result.account;
      }
    } catch (err) {
      Logger.error('Game', 'Auto-login failed', err);
    }

    if (!this._account) {
      const account = this.accountManager.getAccount();
      if (account) this._account = account;
    }

    await this._initManagers();
    await this._startGame(app);
  }

  async _initManagers() {
    this.gameDataManager.init();
    this.scoreManager.init();
    this.autoMiningManager.init();
    this.leaderboardManager.init();
    await this.mailManager.init();
    this.soundManager.init();
    await checkAndSendGifts(this.mailManager, this.accountManager);
    this.accountManager.syncSession();
  }

  async _startGame(app) {
    app.innerHTML = '';

    this.header = new Header(app);
    this.header.render();
    this.header.updateDiamonds(this.gameDataManager.getDiamonds());
    this.header.updateMailCount(this.mailManager.getUnreadCount());

    this.screenManager = new ScreenManager(app, this.events);
    this.screenManager.init();

    this.bottomNav = new BottomNav(app, this.events);
    this.bottomNav.render();

    const home = new HomeScreen(this.events);
    const shop = new ShopScreen(this.events);
    const leaderboard = new LeaderboardScreen(this.events);
    const mail = new MailScreen(this.events);
    const profile = new ProfileScreen(this.events);
    const settings = new SettingsScreen(this.events);

    this.screenManager.register('home', home);
    this.screenManager.register('shop', shop);
    this.screenManager.register('leaderboard', leaderboard);
    this.screenManager.register('mail', mail);
    this.screenManager.register('profile', profile);
    this.screenManager.register('settings', settings);

    this.router.init(this.config.ROUTES);

    this.events.on('nav:change', (path) => this.router.navigate(path));
    this.events.on('route:change', ({ to }) => {
      this.bottomNav.setActive(to.path);
      if (to.name === 'profile') this._updateProfile(profile);
      if (to.name === 'shop') { shop.updateDiamonds(this.gameDataManager.getDiamonds()); this._refreshShopMining(shop); }
      if (to.name === 'leaderboard') this._refreshLeaderboard(leaderboard);
      if (to.name === 'mail') this._refreshMail(mail);
    });

    // Gameplay
    this.events.on('game:tap', () => {
      const result = this.scoreManager.processTap();
      if (result.success) this.soundManager.playTap();
    });
    this.events.on('game:tapProcessed', ({ score }) => {
      home.updateScore(score);
      this.header.updateRank(this.scoreManager.getRank());
      this.leaderboardManager.updateScore(score);
    });
    this.events.on('gamedata:scoreChange', ({ score }) => home.updateScore(score));
    this.events.on('gamedata:diamondChange', ({ diamonds }) => {
      this.header.updateDiamonds(diamonds);
      this._refreshAutoMiningUI(home);
    });

    // Auto Mining
    this._setupAutoMiningUI(home);
    this.events.on('autoMining:activate', ({ package: pkg }) => {
      showPopup(pkg.name + ' activated! ⛏️', 'success');
      this.soundManager.playReward();
      home.showMiningActive(this.autoMiningManager.getStatus());
    });
    this.events.on('autoMining:tick', ({ remainingMs, remainingFormatted, score }) => {
      home.updateMiningTick(remainingMs, remainingFormatted);
      home.updateMiningTotalScore(score);
      this.leaderboardManager.updateScore(score);
    });
    this.events.on('autoMining:expire', () => {
      showPopup('Auto Mining finished!', 'info');
      this.soundManager.playClick();
      home.hideMiningActive();
      this._refreshAutoMiningUI(home);
    });
    this.events.on('autoMining:resume', (status) => home.showMiningActive(status));

    // Leaderboard
    this.events.on('leaderboard:requestUpdate', () => this._refreshLeaderboard(leaderboard));
    this.events.on('leaderboard:update', () => this._refreshLeaderboard(leaderboard));

    // Mail
    this.events.on('mail:new', () => this.header.updateMailCount(this.mailManager.getUnreadCount()));
    this.events.on('mail:claimRequest', ({ mailId }) => {
      const result = this.mailManager.claimReward(mailId);
      if (result.success) {
        showPopup('+' + result.reward.toLocaleString() + ' Diamond claimed!', 'success');
        this.soundManager.playReward();
        this._refreshMail(mail);
      } else {
        showPopup(result.error, 'error');
        this.soundManager.playError();
      }
    });
    this.events.on('mail:claim', () => this.header.updateMailCount(this.mailManager.getUnreadCount()));

    // Settings

    this.events.on('settings:soundToggle', (enabled) => this.soundManager.setEnabled(enabled));

    home.updateScore(this.scoreManager.getScore());
    this._updateProfile(profile);
    this._refreshLeaderboard(leaderboard);
    this._refreshMail(mail);

    Logger.info('Game', 'Game started — Welcome ' + this._account.username);
  }

  async _refreshLeaderboard(screen) {
    ['daily', 'weekly', 'monthly'].forEach((period) => {
      const board = this.leaderboardManager.getBoard(period);
      screen.updateBoard({ period, board });
    });
  }

  _refreshMail(screen) {
    screen.updateMails(this.mailManager.getMails());
  }

  async _setupAutoMiningUI(home) {
    const status = this.autoMiningManager.getStatus();
    const packages = this.autoMiningManager.getPackages();
    if (status.active) {
      home.showMiningActive(status);
    } else {
      home.showMiningPackages(packages,
        (key) => this.gameDataManager.canAfford(packages.find((p) => p.key === key)?.price || Infinity),
        (key) => {
          const result = this.autoMiningManager.activate(key);
          if (!result.success) { showPopup(result.error, 'error'); this.soundManager.playError(); }
        }
      );
    }
  }

  async _refreshAutoMiningUI(home) {
    const status = this.autoMiningManager.getStatus();
    if (!status.active) {
      const packages = this.autoMiningManager.getPackages();
      home.showMiningPackages(packages,
        (key) => this.gameDataManager.canAfford(packages.find((p) => p.key === key)?.price || Infinity),
        (key) => {
          const result = this.autoMiningManager.activate(key);
          if (!result.success) { showPopup(result.error, 'error'); this.soundManager.playError(); }
        }
      );
    }
  }

  _refreshShopMining(shop) {
    const packages = this.autoMiningManager.getPackages();
    shop.setMiningData(packages,
      (price) => this.gameDataManager.canAfford(price),
      (key) => {
        const result = this.autoMiningManager.activate(key);
        if (!result.success) {
          showPopup(result.error, 'error');
          this.soundManager.playError();
        } else {
          shop.updateDiamonds(this.gameDataManager.getDiamonds());
          this.header.updateDiamonds(this.gameDataManager.getDiamonds());
          showPopup('Mining activated! ⛏️', 'success');
          this.soundManager.playReward();
        }
      }
    );
  }

  _updateProfile(screen) {
    if (!this._account) return;
    screen.update({
      username: this._account.username,
      score: this.scoreManager.getScore(),
      taps: this.scoreManager.getTotalTaps(),
      diamonds: this.gameDataManager.getDiamonds(),
      joinDate: this._account.createdAt,
      playerId: this._account.id,
    });
  }

  getState() {
    return {
      account: this._account,
      score: this.scoreManager.getScore(),
      diamonds: this.gameDataManager.getDiamonds(),
      taps: this.scoreManager.getTotalTaps(),
      rank: this.scoreManager.getRank(),
      autoMining: this.autoMiningManager.getStatus(),
      mails: this.mailManager.getMails().length,
      unreadMails: this.mailManager.getUnreadCount(),
    };
  }

  destroy() {
    this._running = false;
    this.router.destroy();
    this.header?.destroy();
    this.bottomNav?.destroy();
    this.screenManager?.destroy();
    this.autoMiningManager?.destroy();
    this.leaderboardManager?.destroy();
    this.mailManager?.destroy();
    this.soundManager?.destroy();
    this.events.clear();
    Logger.info('Game', 'Game destroyed');
  }
}
