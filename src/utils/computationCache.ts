class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

const distanceCache = new LRUCache<string, number>(500);

export function getCachedDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null {
  const key = `${lat1.toFixed(4)},${lng1.toFixed(4)}-${lat2.toFixed(4)},${lng2.toFixed(4)}`;
  return distanceCache.get(key) ?? null;
}

export function setCachedDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  distance: number
): void {
  const key = `${lat1.toFixed(4)},${lng1.toFixed(4)}-${lat2.toFixed(4)},${lng2.toFixed(4)}`;
  distanceCache.set(key, distance);
}

const payoutCache = new LRUCache<number, number>(100);

export function getCachedPayout(distance: number): number | null {
  const key = Math.round(distance * 100) / 100;
  return payoutCache.get(key) ?? null;
}

export function setCachedPayout(distance: number, payout: number): void {
  const key = Math.round(distance * 100) / 100;
  payoutCache.set(key, payout);
}
