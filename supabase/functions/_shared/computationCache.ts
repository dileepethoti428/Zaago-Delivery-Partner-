const cache = new Map<string, { data: any; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
  
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expiry) cache.delete(k);
    }
  }
}

export function getCachedDistance(lat1: number, lng1: number, lat2: number, lng2: number): number | null {
  const key = `dist:${lat1.toFixed(3)},${lng1.toFixed(3)}-${lat2.toFixed(3)},${lng2.toFixed(3)}`;
  return getCached<number>(key);
}

export function setCachedDistance(lat1: number, lng1: number, lat2: number, lng2: number, distance: number): void {
  const key = `dist:${lat1.toFixed(3)},${lng1.toFixed(3)}-${lat2.toFixed(3)},${lng2.toFixed(3)}`;
  setCached(key, distance, 3600000);
}

export function getCachedPayout(distance: number): number | null {
  const key = `payout:${distance.toFixed(2)}`;
  return getCached<number>(key);
}

export function setCachedPayout(distance: number, payout: number): void {
  const key = `payout:${distance.toFixed(2)}`;
  setCached(key, payout, 1800000);
}
