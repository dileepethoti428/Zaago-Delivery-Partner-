const CACHE_KEYS = {
  ORDERS: 'orders',
  PROFILE: 'profile',
  EARNINGS: 'earnings',
  LIVE_EARNINGS: 'live_earnings',
} as const;

const PREFIX = 'zaago_cache_';

export const cache = {
  // Get with agent ID validation
  getForAgent: <T>(key: keyof typeof CACHE_KEYS, agentId: string): T | null => {
    try {
      const fullKey = `${PREFIX}${CACHE_KEYS[key]}_${agentId}`;
      const item = localStorage.getItem(fullKey);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Cache getForAgent error:', e);
      return null;
    }
  },

  // Set with agent ID tagging
  setForAgent: (key: keyof typeof CACHE_KEYS, data: any, agentId: string): void => {
    try {
      const fullKey = `${PREFIX}${CACHE_KEYS[key]}_${agentId}`;
      localStorage.setItem(fullKey, JSON.stringify(data));
    } catch (e) {
      console.error('Cache setForAgent error:', e);
    }
  },

  // Clear all caches for a specific agent
  clearForAgent: (agentId: string): void => {
    Object.values(CACHE_KEYS).forEach(k => {
      try {
        localStorage.removeItem(`${PREFIX}${k}_${agentId}`);
      } catch (e) {
        console.warn(`Failed to remove cache for ${k}:`, e);
      }
    });
  },

  // Clear ALL agent caches (for logout or agent switch)
  clearAll: (): void => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('Cache clearAll error:', e);
    }
  },

  // Legacy methods for backward compatibility
  set: (key: keyof typeof CACHE_KEYS, data: any) => {
    try {
      const fullKey = `${PREFIX}${CACHE_KEYS[key]}`;
      localStorage.setItem(fullKey, JSON.stringify(data));
    } catch (e) {
      console.error('Cache set error:', e);
    }
  },

  get: <T>(key: keyof typeof CACHE_KEYS): T | null => {
    try {
      const fullKey = `${PREFIX}${CACHE_KEYS[key]}`;
      const item = localStorage.getItem(fullKey);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Cache get error:', e);
      return null;
    }
  },

  clear: (key?: keyof typeof CACHE_KEYS) => {
    if (key) {
      localStorage.removeItem(`${PREFIX}${CACHE_KEYS[key]}`);
    } else {
      Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(`${PREFIX}${k}`));
    }
  },

  hasCache: () => {
    return Object.values(CACHE_KEYS).some(k => localStorage.getItem(`${PREFIX}${k}`) !== null);
  },
};
