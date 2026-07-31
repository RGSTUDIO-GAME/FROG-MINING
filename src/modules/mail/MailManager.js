import { Config } from '@core/Config.js';
import { Logger } from '@utils/logger.js';
import { Api } from '@utils/api.js';
import { MailConfig } from './MailConfig.js';
import { generateUUID } from '@utils/helpers.js';

/**
 * MailManager — Handles mail with API sync.
 */
export class MailManager {
  constructor(eventBus, gameDataManager, accountManager) {
    this.events = eventBus;
    this.gameDataManager = gameDataManager;
    this.accountManager = accountManager;
    this._storageKey = Config.STORAGE_KEY + ':mails';
    this._mails = [];
  }

  async init() {
    const account = this.accountManager.getAccount();
    if (!account) return;

    // Load local cache
    this._mails = this._load(account.id);

    // Sync from server
    await this._syncFromServer(account.id);

    this._checkExpiry();
    Logger.info('MailManager', 'Initialized — ' + this._mails.length + ' mails');
  }

  async _syncFromServer(playerId) {
    const result = await Api.getMails(playerId);
    if (result.success && result.data.mails) {
      const serverMails = result.data.mails.map((m) => ({
        id: m.id,
        playerId: m.player_id,
        title: m.title,
        content: m.content,
        category: m.category,
        rewardType: m.reward_type,
        rewardAmount: m.reward_amount,
        claimStatus: m.claim_status,
        read: m.claim_status === 'claimed',
        createdAt: m.created_at,
        expiresAt: m.expired_at,
      }));

      // Merge: prefer server data, keep local unclaimed
      const localUnclaimed = this._mails.filter(
        (m) => m.claimStatus === 'unclaimed' &&
          !serverMails.find((s) => s.id === m.id || (s.title === m.title && s.category === m.category))
      );

      this._mails = [...serverMails, ...localUnclaimed];
      this._save(playerId);
    }
  }

  getMails(filter = 'all') {
    let mails = [...this._mails];
    switch (filter) {
      case 'unread': mails = mails.filter((m) => !m.read); break;
      case 'hasReward': mails = mails.filter((m) => m.rewardType && m.rewardAmount > 0 && m.claimStatus === 'unclaimed'); break;
      case 'claimed': mails = mails.filter((m) => m.claimStatus === 'claimed'); break;
      case 'expired': mails = mails.filter((m) => m.claimStatus === 'expired'); break;
    }
    mails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return mails;
  }

  getMail(mailId) { return this._mails.find((m) => m.id === mailId) || null; }
  getUnreadCount() { return this._mails.filter((m) => !m.read).length; }
  getUnclaimedCount() { return this._mails.filter((m) => m.rewardType && m.rewardAmount > 0 && m.claimStatus === 'unclaimed').length; }

  createMail({ title, content, category = 'announcement', rewardType = null, rewardAmount = 0, expiryDays = null }) {
    const account = this.accountManager.getAccount();
    if (!account) return null;

    const now = new Date();
    const expiry = expiryDays ?? MailConfig.DEFAULT_EXPIRY_DAYS;
    const expiresAt = expiry > 0 ? new Date(now.getTime() + expiry * 24 * 60 * 60 * 1000).toISOString() : null;

    const mail = {
      id: generateUUID(),
      playerId: account.id,
      title,
      content,
      category,
      rewardType,
      rewardAmount,
      claimStatus: rewardType ? 'unclaimed' : 'none',
      read: false,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this._mails.unshift(mail);
    this._save(account.id);
    this.events.emit('mail:new', { mail });

    // Try API sync in background
    Api.createMail(account.id, title, content, category, rewardType, rewardAmount).catch(() => {});

    return mail;
  }

  markRead(mailId) {
    const mail = this._mails.find((m) => m.id === mailId);
    if (!mail) return false;
    mail.read = true;
    this._save(this.accountManager.getAccount()?.id);
    return true;
  }

  async claimReward(mailId) {
    const mail = this._mails.find((m) => m.id === mailId);
    if (!mail) return { success: false, error: 'Mail not found' };
    if (!mail.rewardType || mail.rewardAmount <= 0) return { success: false, error: 'No reward' };
    if (mail.claimStatus === 'claimed') return { success: false, error: 'Already claimed' };
    if (mail.claimStatus === 'expired') return { success: false, error: 'Expired' };

    const account = this.accountManager.getAccount();

    // Claim on server
    const result = await Api.claimMail(account.id, mailId);
    if (result.success) {
      // Update local diamonds from server
      this.gameDataManager.addDiamonds(mail.rewardAmount, 'mail');
      mail.claimStatus = 'claimed';
      mail.read = true;
      this._save(account.id);
      this.events.emit('mail:claim', { mailId, reward: mail.rewardAmount });
      return { success: true, reward: mail.rewardAmount };
    }

    // Fallback: claim locally
    if (mail.rewardType === 'diamond') {
      this.gameDataManager.addDiamonds(mail.rewardAmount, 'mail');
    }
    mail.claimStatus = 'claimed';
    mail.read = true;
    this._save(account.id);
    this.events.emit('mail:claim', { mailId, reward: mail.rewardAmount });
    return { success: true, reward: mail.rewardAmount };
  }

  deleteMail(mailId) {
    const index = this._mails.findIndex((m) => m.id === mailId);
    if (index === -1) return false;
    this._mails.splice(index, 1);
    this._save(this.accountManager.getAccount()?.id);
    return true;
  }

  _checkExpiry() {
    const now = new Date();
    this._mails.forEach((mail) => {
      if (mail.claimStatus === 'unclaimed' && mail.expiresAt && new Date(mail.expiresAt) < now) {
        mail.claimStatus = 'expired';
      }
    });
  }

  _save(playerId) {
    if (!playerId) return;
    localStorage.setItem(this._storageKey + ':' + playerId, JSON.stringify(this._mails));
  }

  _load(playerId) {
    try {
      const raw = localStorage.getItem(this._storageKey + ':' + playerId);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  destroy() {}
}
