interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  ttl: number;
}

const CACHE_VERSION = '1.0';

export class AdvancedCache {
  private prefix = 'zaago_v2_';

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      ttl: ttlMs,
    };
    
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length > 100000) {
        console.warn(`Cache entry ${key} is large: ${serialized.length} bytes`);
      }
      localStorage.setItem(this.prefix + key, serialized);
    } catch (e) {
      console.error('Cache set failed:', e);
      this.evictOldest();
      try {
        localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      } catch {
        console.error('Cache retry failed');
      }
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      
      if (entry.version !== CACHE_VERSION) {
        this.delete(key);
        return null;
      }

      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (e) {
      console.error('Cache get failed:', e);
      return null;
    }
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k));
  }

  private evictOldest(): void {
    const entries = Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .map(k => {
        try {
          const entry = JSON.parse(localStorage.getItem(k)!);
          return { key: k, timestamp: entry.timestamp };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a!.timestamp - b!.timestamp);

    if (entries.length > 0 && entries[0]) {
      localStorage.removeItem(entries[0].key);
    }
  }

  getStats() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
    const totalSize = keys.reduce((sum, k) => {
      return sum + (localStorage.getItem(k)?.length || 0);
    }, 0);
    
    return {
      entries: keys.length,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      keys: keys.map(k => k.replace(this.prefix, '')),
    };
  }
}

export const advancedCache = new AdvancedCache();
