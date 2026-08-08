import { EventBus } from './EventBus.js';
import { Router } from './Router.js';
import { Config } from './Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';

import { AccountManager } from '@modules/account/AccountManager.js';
import { GameDataManager } from '@modules/account/GameDataManager.js';
import { ScoreManager } from '@modules/gameplay/ScoreManager.js';
import { AutoMiningManager } from '@modules/gameplay/AutoMiningManager.js';
import { SoundManager } from '@modules/gameplay/SoundManager.js';
import { LeaderboardManager } from '@modules/leaderboard/LeaderboardManager.js';
import { MailManager } from '@modules/mail/MailManager.js';

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
import { RunnerScreen } from '@screens/RunnerScreen.js';

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
    // Guarantee an account exists instantly (local fallback) so the game
    // always opens — auto-login to the server runs in the background.
    try {
      this._account = this.accountManager.getOrCreateLocalAccount();
    } catch (err) {
      Logger.error('Game', 'Local account failed', err);
    }

    this.events.on('account:serverReady', (account) => this._onServerAccount(account));

    // Background server login — never blocks the loading screen.
    this.accountManager.autoLogin().catch((err) => {
      Logger.error('Game', 'Auto-login failed', err);
    });

    await this._initManagers();
    await this._startGame(app);
  }

  async _onServerAccount(account) {
    if (!account) return;
    const previous = this._account;
    this._account = account;

    // Re-sync all managers with the server account and refresh the UI.
    try {
      await this._initManagers();
    } catch (err) {
      Logger.error('Game', 'Re-sync managers failed', err);
    }

    const home = this.screenManager?.getScreen('home');
    const shop = this.screenManager?.getScreen('shop');
    const profile = this.screenManager?.getScreen('profile');
    const mail = this.screenManager?.getScreen('mail');

    home?.updateScore(this.scoreManager.getScore());
    home?.updateDiamonds(this.gameDataManager.getDiamonds());
    this.header?.updateDiamonds(this.gameDataManager.getDiamonds());
    this.header?.updateMailCount(this.mailManager.getUnreadCount());
    this._updateHeaderRank();
    shop?.updateDiamonds(this.gameDataManager.getDiamonds());
    if (profile) this._updateProfile(profile);
    this._refreshReferralInfo(account);
    if (mail) this._refreshMail(mail);
    const lbScreen = this.screenManager?.getScreen('leaderboard');
    if (lbScreen) this._refreshLeaderboard(lbScreen);
    if (home) this._refreshAutoMiningUI(home);
    if (shop) this._refreshShopMining(shop);

    if (previous && previous.offline) {
      showPopup('Koneksi pulih — akun tersinkron!', 'success', 2200);
    }
    Logger.info('Game', 'Server account aktif: ' + account.username);
  }

  async _initManagers() {
    this.gameDataManager.init();
    this.scoreManager.init();
    this.autoMiningManager.init();
    this.leaderboardManager.init();
    await this.mailManager.init();
    this.soundManager.init();
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

    const runner = new RunnerScreen(this.events);
    this.screenManager.register('runner', runner);

    // Route mini-game (tersembunyi — tidak muncul di bottom nav)
    this.router.routes.set('/runner', { path: '/runner', name: 'runner' });

    this.router.init(this.config.ROUTES);

    this.events.on('nav:change', (path) => this.router.navigate(path));
    this.events.on('route:change', ({ to }) => {
      this.bottomNav.setActive(to.path);
      if (to.name === 'home') {
        home.updateScore(this.scoreManager.getScore());
        home.updateDiamonds(this.gameDataManager.getDiamonds());
        this._refreshAutoMiningUI(home);
      }
      if (to.name === 'profile') {
        this._updateProfile(profile);
        this._refreshReferralInfo(this._account || this.accountManager.getAccount());
      }
      if (to.name === 'shop') { shop.updateDiamonds(this.gameDataManager.getDiamonds()); this._refreshShopMining(shop); }
      if (to.name === 'leaderboard') this._refreshLeaderboard(leaderboard);
      if (to.name === 'mail') this._refreshMail(mail);
    });

    // Mini-game Frog Runner
    this.events.on('game:runnerPlay', () => {
      const hash = window.location.hash.slice(1) || '/';
      if (hash !== '/runner') {
        this.router.navigate('/runner');
      } else {
        this.screenManager.showScreen('runner');
      }
    });
    this.events.on('runner:quit', () => {
      const hash = window.location.hash.slice(1) || '/';
      if (hash !== '/') {
        this.router.navigate('/');
      } else {
        this.screenManager.showScreen('home');
        this.bottomNav.setActive('/');
      }
    });
    this.events.on('runner:gameOver', ({ score }) => {
      const amount = Math.max(1, Math.floor(score || 0));
      this.gameDataManager.addScoreFromAutoMining(amount);
      this.leaderboardManager.updateScore(this.scoreManager.getScore());
      const account = this._account || this.accountManager.getAccount();
      if (!account?.id) return;
      Api.submitRunnerScore(account.id, amount).then((res) => {
        if (!res.success) Logger.warn('Game', 'Runner score sync gagal', res.error);
      });
    });

    // Gameplay
    this.events.on('game:tap', () => {
      const result = this.scoreManager.processTap();
      if (result.success) this.soundManager.playTap();
    });
    this.events.on('game:tapProcessed', ({ score }) => {
      home.updateScore(score);
      this.leaderboardManager.updateScore(score);
    });
    this.events.on('gamedata:scoreChange', ({ score }) => home.updateScore(score));
    this.events.on('gamedata:diamondChange', ({ diamonds }) => {
      this.header.updateDiamonds(diamonds);
      home.updateDiamonds(diamonds);
      this._refreshAutoMiningUI(home);
    });

    // Auto Mining
    this._setupAutoMiningUI(home);
    this.events.on('autoMining:activate', ({ package: pkg }) => {
      showPopup(pkg.name + ' activated! ⛏️', 'success');
      this.soundManager.playReward();
      home.showMiningActive(this.autoMiningManager.getStatus());
      if (shop) this._refreshShopMining(shop);
    });
    this.events.on('autoMining:tick', ({ remainingMs, remainingFormatted, score }) => {
      home.updateMiningTick(remainingMs, remainingFormatted);
      shop.updateMiningTick(remainingFormatted);
      home.updateMiningTotalScore(score);
      this.leaderboardManager.updateScore(score);
    });
    this.events.on('autoMining:expire', () => {
      showPopup('Auto Mining finished!', 'info');
      this.soundManager.playClick();
      home.hideMiningActive();
      this._refreshAutoMiningUI(home);
      if (shop) this._refreshShopMining(shop);
    });
    this.events.on('autoMining:resume', (status) => {
      home.showMiningActive(status);
      if (shop) this._refreshShopMining(shop);
    });

    // Shop — diamond purchase (works when the server enables simulated shop)
    this.events.on('shop:buy', async ({ productId }) => {
      const account = this._account || this.accountManager.getAccount();
      if (!account?.id) return;
      const result = await Api.purchaseProduct(account.id, productId);
      if (result.success) {
        if (typeof result.data?.diamonds === 'number') {
          this.gameDataManager.setDiamonds(result.data.diamonds);
        }
        showPopup('Pembelian berhasil!', 'success');
        this.soundManager.playReward();
      } else {
        showPopup(result.error || 'Pembelian gagal, coba lagi', 'error');
        this.soundManager.playError();
      }
    });

    // Leaderboard
    this.events.on('leaderboard:requestUpdate', () => {
      this.leaderboardManager.refresh().then(() => this._refreshLeaderboard(leaderboard)).catch(() => {});
    });
    // Re-render leaderboard is debounced: updateScore fires on every tap.
    this._refreshLeaderboardDebounced = this._debounce(() => this._refreshLeaderboard(leaderboard), 600);
    this.events.on('leaderboard:update', () => this._refreshLeaderboardDebounced());

    // Mail
    this.events.on('mail:new', () => this.header.updateMailCount(this.mailManager.getUnreadCount()));
    this.events.on('mail:open', ({ mailId }) => {
      this.mailManager.markRead(mailId);
      this.header.updateMailCount(this.mailManager.getUnreadCount());
    });

    this.events.on('mail:claimRequest', async ({ mailId }) => {
      const result = await this.mailManager.claimReward(mailId);
      if (result.success) {
        showPopup('+' + result.reward.toLocaleString() + ' Diamond claimed!', 'success');
        this.soundManager.playReward();
        this._refreshMail(mail);
      } else {
        showPopup(result.error || 'Claim gagal, coba lagi', 'error');
        this.soundManager.playError();
      }
    });
    this.events.on('mail:claim', () => this.header.updateMailCount(this.mailManager.getUnreadCount()));

    // Settings

    this.events.on('settings:soundToggle', (enabled) => this.soundManager.setEnabled(enabled));
    this.events.on('settings:musicToggle', (enabled) => this.soundManager.setMusicEnabled(enabled));
    this.events.on('settings:musicVolume', (volume) => this.soundManager.setMusicVolume(volume));
    this.events.on('settings:soundVolume', (volume) => this.soundManager.setSoundVolume(volume));
    this.events.on('settings:stateRequest', () => {
      this.events.emit('settings:state', this.soundManager.getState());
      const account = this._account || this.accountManager.getAccount();
      if (account) this._refreshReferralInfo(account);
    });

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
    this._updateHeaderRank();
  }

  /**
   * Header rank comes from the real daily leaderboard position
   * (server-synced), not a guessed number.
   */
  _updateHeaderRank() {
    const board = this.leaderboardManager.getBoard('daily');
    this.header?.updateRank(board.playerRank ?? '--');
  }

  _debounce(fn, wait) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, wait);
    };
  }

  _refreshMail(screen) {
    screen.updateMails(this.mailManager.getMails());
  }

  _activateMining(key) {
    this._activateMiningAsync(key).catch(() => {
      showPopup('Gagal mengaktifkan Auto Mining', 'error');
      this.soundManager.playError();
    });
  }

  async _activateMiningAsync(key) {
    const result = await this.autoMiningManager.activate(key);
    if (!result.success) {
      showPopup(result.error || 'Gagal mengaktifkan Auto Mining', 'error');
      this.soundManager.playError();
    }
  }

  async _setupAutoMiningUI(home) {
    const status = this.autoMiningManager.getStatus();
    const packages = this.autoMiningManager.getPackages();
    if (status.active) {
      home.showMiningActive(status);
    } else {
      home.showMiningPackages(packages,
        (key) => this.gameDataManager.canAfford(packages.find((p) => p.key === key)?.price || Infinity),
        (key) => this._activateMining(key)
      );
    }
  }

  async _refreshAutoMiningUI(home) {
    const status = this.autoMiningManager.getStatus();
    if (status.active) {
      home.showMiningActive(status);
    } else {
      const packages = this.autoMiningManager.getPackages();
      home.showMiningPackages(packages,
        (key) => this.gameDataManager.canAfford(packages.find((p) => p.key === key)?.price || Infinity),
        (key) => this._activateMining(key)
      );
    }
  }

  _refreshShopMining(shop) {
    const status = this.autoMiningManager.getStatus();
    if (status.active) {
      shop.showMiningActive(status);
      return;
    }
    const packages = this.autoMiningManager.getPackages();
    shop.setMiningData(packages,
      (price) => this.gameDataManager.canAfford(price),
      (key) => this._activateMining(key)
    );
  }

  _updateProfile(screen) {
    if (!this._account) return;
    screen.update({
      loginMode: this._account.offline ? 'Mode: Perangkat (offline)' : (this._account.telegramId ? 'Mode: Telegram (nama: @' + (this._account.username || '') + ')' : 'Mode: Perangkat'),
      username: this._account.username,
      score: this.scoreManager.getScore(),
      taps: this.scoreManager.getTotalTaps(),
      diamonds: this.gameDataManager.getDiamonds(),
      joinDate: this._account.createdAt,
      playerId: this._account.id,
      invitedCount: this._account.invitedCount || 0,
    });
  }

  async _refreshReferralInfo(account) {
    if (!account?.id) return;
    const res = await Api.getReferral(account.id);
    if (!res.success || !res.data) return;

    const code = res.data.refCode || account.refCode;
    if (!code) return;

    this.accountManager.updateAccount({
      refCode: code,
      invitedCount: res.data.invitedCount || 0,
    });
    this._account = this.accountManager.getAccount();

    // Game ini Telegram Mini App — link undangan selalu format Telegram
    // (buka bot lalu langsung buka app dengan startapp=ref_CODE).
    const base = 'https://t.me/' + Config.APP.TELEGRAM_BOT + '/' + Config.APP.TELEGRAM_APP + '?startapp=ref_';
    this.events.emit('settings:referral', {
      inviteUrl: base + code,
      code,
      invitedCount: res.data.invitedCount || 0,
    });

    const profile = this.screenManager?.getScreen('profile');
    if (profile) this._updateProfile(profile);
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
