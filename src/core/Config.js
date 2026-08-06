/**
 * Config — Centralized game configuration.
 * All settings come from env or this file. Never hardcode elsewhere.
 */
export const Config = {
  APP: {
    NAME: import.meta.env.VITE_APP_NAME || 'Frog Mining',
    VERSION: import.meta.env.VITE_APP_VERSION || '0.1.0',
    ENV: import.meta.env.VITE_ENV || 'development',
    DEBUG: import.meta.env.VITE_DEBUG === 'true',
    TELEGRAM_BOT: 'frogmininggame_bot',
    TELEGRAM_APP: 'frogmining',
  },

  API: {
    BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
    TIMEOUT: 10000,
  },

  ROUTES: [
    { path: '/', name: 'home', icon: '🏠', label: 'Home' },
    { path: '/shop', name: 'shop', icon: '🛒', label: 'Shop' },
    { path: '/leaderboard', name: 'leaderboard', icon: '🏆', label: 'Board' },
    { path: '/mail', name: 'mail', icon: '📬', label: 'Mail' },
    { path: '/profile', name: 'profile', icon: '👤', label: 'Profile' },
    { path: '/settings', name: 'settings', icon: '⚙️', label: 'Settings' },
  ],

  SCORE: {
    PER_TAP: 1,
  },

  AUTO_MINING: {
    SCORE_PER_SECOND: 1,
    PACKAGES: [
      {
        key: 'quick',
        name: 'Quick Mine',
        icon: '⚡',
        price: 500,
        duration: 7200,
        badge: '',
        color: '#74C69D',
      },
      {
        key: 'basic',
        name: 'Basic Mine',
        icon: '⛏️',
        price: 1000,
        duration: 18000,
        badge: '',
        color: '#48BFE3',
      },
      {
        key: 'power',
        name: 'Power Mine',
        icon: '🔥',
        price: 2500,
        duration: 43200,
        badge: 'HOT',
        color: '#F4845F',
      },
      {
        key: 'premium',
        name: 'Premium Mine',
        icon: '💎',
        price: 5000,
        duration: 86400,
        badge: 'BEST',
        color: '#D4A017',
      },
      {
        key: 'royal',
        name: 'Royal Mine',
        icon: '👑',
        price: 15000,
        duration: 259200,
        badge: 'LEGEND',
        color: '#7B68EE',
      },
    ],
  },

  SHOP: {
    DIAMOND_PACKAGES: [
      { id: 'starter', name: 'Starter', icon: '💎', diamond: 10, price: 'Rp 5.000', bonus: 0, popular: false },
      { id: 'basic', name: 'Basic', icon: '💎', diamond: 50, price: 'Rp 20.000', bonus: 5, popular: false },
      { id: 'mega', name: 'Mega', icon: '💎', diamond: 200, price: 'Rp 50.000', bonus: 30, popular: true },
      { id: 'ultimate', name: 'Ultimate', icon: '💎', diamond: 500, price: 'Rp 100.000', bonus: 100, popular: false },
      { id: 'royal', name: 'Royal', icon: '💎', diamond: 1500, price: 'Rp 250.000', bonus: 400, popular: false },
    ],
  },

  STORAGE_KEY: 'frog-mining-v3',
};
