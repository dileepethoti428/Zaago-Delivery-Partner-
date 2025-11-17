export function getCacheHeaders(maxAgeSeconds: number) {
  return {
    'Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`,
    'CDN-Cache-Control': `max-age=${maxAgeSeconds}`,
    'Surrogate-Control': `max-age=${maxAgeSeconds}`,
  };
}

export const CACHE_DURATIONS = {
  NONE: 0,
  SHORT: 30,
  MEDIUM: 300,
  LONG: 3600,
  VERY_LONG: 86400,
};
