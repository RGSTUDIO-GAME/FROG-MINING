import { Logger } from '@utils/logger.js';

/**
 * AdminGift — Auto-send welcome gift to ALL players.
 */
export async function checkAndSendGifts(mailManager, accountManager) {
  const account = accountManager.getAccount();
  if (!account) return;

  const gift = {
    title: '🎁 Welcome Gift',
    content: 'Selamat datang di Frog Mining! Nikmati 5.000 Diamond sebagai hadiah sambutan. Gunakan untuk Auto Mining! 🐸⛏️',
    category: 'admin',
    rewardType: 'diamond',
    rewardAmount: 5000,
  };

  // Check if already sent
  const existing = mailManager.getMails().find(
    (m) => m.title === gift.title && m.category === 'admin'
  );

  if (!existing) {
    await mailManager.createMail(gift);
    Logger.info('AdminGift', 'Welcome gift sent to: ' + account.username);
  }
}
