import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';
import { generateUUID } from '@utils/helpers.js';

/**
 * AccountManager — Email/password auth with API + localStorage fallback.
 */
export class AccountManager {
  constructor(eventBus) {
    this.events = eventBus;
    this._storageKey = Config.STORAGE_KEY + ':account';
    this._sessionKey = Config.STORAGE_KEY + ':session';
    this._account = null;
  }

  checkSession() {
    try {
      const session = this._load(this._sessionKey);
      const account = this._load(this._storageKey);
      if (session && session.active && account && account.id) {
        this._account = account;
        Logger.info('Account', 'Session found: ' + account.username);
        return { hasAccount: true, account };
      }
      return { hasAccount: false, account: null };
    } catch {
      return { hasAccount: false, account: null };
    }
  }

  /**
   * Local fallback account so the game can always open instantly.
   * The server account (if any) takes over via background auto-login.
   */
  getOrCreateLocalAccount() {
    const existing = this.getAccount();
    if (existing && existing.id) return existing;

    const deviceId = this._getDeviceId();
    const tg = this._getTelegramUser();
    const account = {
      id: deviceId || generateUUID(),
      username: this._friendlyTelegramName(tg),
      email: null,
      avatar: (tg && tg.photo_url) || '🐸',
      totalScore: 0,
      totalDiamond: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      accountStatus: 'active',
      offline: true,
    };
    this._activateSession(account);
    this._saveAccount(account);
    return account;
  }

  /**
   * Auto-login — Telegram Mini App users are identified by their Telegram ID.
   * Outside Telegram (web), a per-device anonymous account is used.
   * No registration form, no logout. Runs in the background and never blocks
   * the game from opening (the caller should already have a local account).
   */
  async autoLogin() {
    const deviceId = this._getDeviceId();
    const tg = this._getTelegramUser();
    const ref = this._getRefParam();

    let res = null;
    if (tg) {
      const name = this._friendlyTelegramName(tg);
      res = await Api.telegramLogin(tg.id, name, tg.photo_url || '🐸', deviceId, tg.first_name, ref);
    } else {
      res = await Api.deviceLogin(deviceId, null, ref);
    }

    if (res && res.success) {
      const p = res.data.player;
      const account = this._fromServerPlayer(p, null, null);
      this._activateSession(account);
      this._saveAccount(account);
      Logger.info('Account', 'Auto-login: ' + account.username);
      this.events.emit('account:login', account);
      this.events.emit('account:serverReady', account);
      return { success: true, account, server: true };
    }

    // Offline fallback — keep the local account and retry in the background.
    Logger.info('Account', 'Auto-login offline, reconnect terjadwal');
    this._scheduleReconnect();
    return { success: false, account: this.getAccount(), server: false };
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setInterval(async () => {
      const deviceId = this._getDeviceId();
      const tg = this._getTelegramUser();
      const ref = this._getRefParam();
      let res = null;

      if (tg) {
        const name = this._friendlyTelegramName(tg);
        res = await Api.telegramLogin(tg.id, name, tg.photo_url || '🐸', deviceId, tg.first_name, ref);
      } else {
        res = await Api.deviceLogin(deviceId, null, ref);
      }

      if (res && res.success) {
        clearInterval(this._reconnectTimer);
        this._reconnectTimer = null;
        const account = this._fromServerPlayer(res.data.player, null, null);
        this._activateSession(account);
        this._saveAccount(account);
        Logger.info('Account', 'Koneksi pulih — akun server tersinkron');
        this.events.emit('account:login', account);
        this.events.emit('account:serverReady', account);
      }
    }, 10000);
  }

  async register(username, email, password) {
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const deviceId = this._getDeviceId();
    const ref = this._getRefParam();

    // Try server first (source of truth)
    const res = await Api.register(trimmedUser, trimmedEmail, password, deviceId, ref);
    if (res.success) {
      const p = res.data.player;
      const account = this._fromServerPlayer(p, trimmedEmail, password);
      this._activateSession(account);
      this._saveAccount(account);
      Logger.info('Account', 'Registered (server): ' + trimmedUser);
      this.events.emit('account:register', account);
      return { success: true, account, server: true };
    }

    // Server reachable but rejected — show the real error
    if (!res.offline) {
      return { success: false, error: res.error || 'Gagal membuat akun' };
    }

    // Server offline — fallback to local account
    const accounts = this._loadAllAccounts();
    if (accounts.length > 0) {
      return { success: false, error: 'Perangkat ini sudah terdaftar dengan akun lain' };
    }
    const existEmail = accounts.find((a) => a.email === trimmedEmail);
    if (existEmail) {
      return { success: false, error: 'Email sudah terdaftar' };
    }
    const existUser = accounts.find((a) => a.username === trimmedUser);
    if (existUser) {
      return { success: false, error: 'Username sudah digunakan' };
    }

    const account = {
      id: generateUUID(), username: trimmedUser, email: trimmedEmail,
      avatar: '🐸', password, totalScore: 0, totalDiamond: 0,
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(),
      accountStatus: 'active', offline: true,
    };

    this._activateSession(account);
    this._saveAccount(account);
    Logger.info('Account', 'Registered (offline): ' + trimmedUser);
    this.events.emit('account:register', account);
    return { success: true, account, server: false };
  }

  async login(email, password) {
    const trimmedEmail = email.trim().toLowerCase();
    const deviceId = this._getDeviceId();

    // Try server first (source of truth)
    const res = await Api.login(trimmedEmail, password, deviceId);
    if (res.success) {
      const p = res.data.player;
      const account = this._fromServerPlayer(p, trimmedEmail, password);
      this._activateSession(account);
      this._saveAccount(account);
      Logger.info('Account', 'Logged in (server): ' + account.username);
      this.events.emit('account:login', account);
      return { success: true, account, server: true };
    }

    const accounts = this._loadAllAccounts();
    const account = accounts.find((a) => a.email === trimmedEmail);

    if (!account) {
      return { success: false, error: res.offline ? 'Email tidak ditemukan' : (res.error || 'Email tidak ditemukan') };
    }
    if (account.password !== password) {
      return { success: false, error: res.offline ? 'Password salah' : (res.error || 'Password salah') };
    }

    this._account = { ...account, password: undefined };
    account.lastLoginAt = new Date().toISOString();
    this._save(this._storageKey, account);
    this._save(this._sessionKey, { active: true, playerId: account.id });
    this._saveAccount(account);

    Logger.info('Account', 'Logged in: ' + account.username);
    this.events.emit('account:login', account);
    return { success: true, account };
  }

  _fromServerPlayer(p, email, password) {
    return {
      id: p.id,
      username: this._cleanServerName(p.username, p.id),
      email,
      avatar: p.avatar || '🐸',
      password,
      totalScore: p.total_score || 0,
      totalDiamond: p.total_diamonds || 0,
      createdAt: p.created_at || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      accountStatus: p.status || 'active',
      telegramId: p.telegram_id || null,
      refCode: p.ref_code || null,
      server: true,
    };
  }

  _friendlyTelegramName(tg) {
    if (!tg) return 'Pemain';
    const username = String(tg.username || '').trim();
    if (username && !/^\d+$/.test(username)) return username;
    const full = [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim();
    if (full && !/^\d+$/.test(full)) return full;
    const id = String(tg.id || '');
    return id ? 'Frog#' + id.slice(-4) : 'Pemain';
  }

  _cleanServerName(name, playerId) {
    const n = String(name || '').trim();
    if (n && !/^\d+$/.test(n)) return n;
    const id = String(playerId || '').replace(/[^a-z0-9]/gi, '').slice(-4);
    return id ? 'Frog#' + id : 'Pemain';
  }

  _getDeviceId() {
    const key = Config.STORAGE_KEY + ':deviceId';
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = generateUUID();
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return null;
    }
  }

  _getTelegramUser() {
    try {
      const tg = window.Telegram?.WebApp?.initDataUnsafe;
      if (tg && tg.user && tg.user.id) return tg.user;
    } catch { /* not in Telegram */ }

    // Fallback: parse user dari initData / parameter tgWebAppData di URL.
    try {
      const raw = window.Telegram?.WebApp?.initData || this._getUrlParam('tgWebAppData') || '';
      if (raw) {
        const params = new URLSearchParams(raw);
        const userRaw = params.get('user');
        if (userRaw) {
          const user = JSON.parse(decodeURIComponent(userRaw));
          if (user && user.id) return user;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  _getUrlParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name) || '';
    } catch { return ''; }
  }

  _getRefParam() {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) return ref;
      const startapp = url.searchParams.get('startapp');
      if (startapp && startapp.startsWith('ref_')) return startapp.slice(4);
      // Telegram Web App fallback di browser memakai tgWebAppStartParam
      const tgStart = url.searchParams.get('tgWebAppStartParam');
      if (tgStart && tgStart.startsWith('ref_')) return tgStart.slice(4);
    } catch { /* ignore */ }
    try {
      const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (startParam && startParam.startsWith('ref_')) return startParam.slice(4);
    } catch { /* ignore */ }
    return null;
  }

  _activateSession(account) {
    this._account = account;
    this._save(this._storageKey, account);
    this._save(this._sessionKey, { active: true, playerId: account.id });
  }

  async syncSession() {
    if (!this._account) return;
    const result = await Api.getSession(this._account.id);
    if (result.success) {
      const p = result.data.player;
      this._account.totalScore = p.total_score;
      this._account.totalDiamond = p.total_diamonds;
      this._save(this._storageKey, this._account);
    }
  }

  getAccount() {
    return this._account || this._load(this._storageKey);
  }

  updateAccount(updates) {
    const account = this.getAccount();
    if (!account) return false;
    Object.assign(account, updates);
    this._account = account;
    this._save(this._storageKey, account);
    return true;
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') return { valid: false, error: 'Username wajib diisi' };
    const t = username.trim();
    if (t.length < 3) return { valid: false, error: 'Username minimal 3 karakter' };
    if (t.length > 20) return { valid: false, error: 'Username maksimal 20 karakter' };
    if (!/^[a-zA-Z0-9_]+$/.test(t)) return { valid: false, error: 'Username hanya huruf, angka, underscore' };
    return { valid: true };
  }

  _loadAllAccounts() {
    try {
      const raw = localStorage.getItem(Config.STORAGE_KEY + ':accounts');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _saveAccount(account) {
    const accounts = this._loadAllAccounts();
    const idx = accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) accounts[idx] = account;
    else accounts.push(account);
    localStorage.setItem(Config.STORAGE_KEY + ':accounts', JSON.stringify(accounts));
  }

  _save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  _load(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } }
}
