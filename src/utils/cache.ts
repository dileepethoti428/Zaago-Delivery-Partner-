const CACHE_KEYS = {
  ORDERS: 'zaago_cache_orders',
  PROFILE: 'zaago_cache_profile',
  EARNINGS: 'zaago_cache_earnings',
  LIVE_EARNINGS: 'zaago_cache_live_earnings',
} as const;

export const cache = {
  set: (key: keyof typeof CACHE_KEYS, data: any) => {
    try {
      localStorage.setItem(CACHE_KEYS[key], JSON.stringify(data));
    } catch (e) {
      console.error('Cache set error:', e);
    }
  },

  get: <T>(key: keyof typeof CACHE_KEYS): T | null => {
    try {
      const item = localStorage.getItem(CACHE_KEYS[key]);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Cache get error:', e);
      return null;
    }
  },

  clear: (key?: keyof typeof CACHE_KEYS) => {
    if (key) {
      localStorage.removeItem(CACHE_KEYS[key]);
    } else {
      Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
    }
  },

  hasCache: () => {
    return Object.values(CACHE_KEYS).some(k => localStorage.getItem(k) !== null);
  },
};
