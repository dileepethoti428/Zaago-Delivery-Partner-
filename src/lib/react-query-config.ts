import { QueryClient } from '@tanstack/react-query';

// Enhanced Query Client with caching strategies
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Enable background refetch
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Serve stale data while refetching
      refetchOnMount: 'always',
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Manual localStorage persistence for caching
if (typeof window !== 'undefined') {
  const savedCache = localStorage.getItem('zaago-query-cache');
  if (savedCache) {
    try {
      const parsedCache = JSON.parse(savedCache);
      // Restore queries if they're not too old
      if (Date.now() - (parsedCache.timestamp || 0) < 24 * 60 * 60 * 1000) {
        Object.entries(parsedCache.queries || {}).forEach(([key, data]: [string, any]) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }
    } catch (error) {
      console.warn('Failed to restore query cache:', error);
    }
  }
}

// Query keys for consistent caching
export const queryKeys = {
  orders: ['orders'] as const,
  orderDetails: (id: string) => ['orders', id] as const,
  agentLocation: ['agent-location'] as const,
  distances: (agentId: string) => ['distances', agentId] as const,
  agentSettings: ['agent-settings'] as const,
  availableOrders: (agentId: string, location: { lat: number; lng: number }) => 
    ['available-orders', agentId, location] as const,
} as const;

// Cache optimization utilities
export const cacheUtils = {
  // Prefetch likely needed data
  prefetchOrderDetails: async (orderIds: string[]) => {
    const promises = orderIds.slice(0, 5).map(id => 
      queryClient.prefetchQuery({
        queryKey: queryKeys.orderDetails(id),
        staleTime: 10 * 60 * 1000, // 10 minutes
      })
    );
    await Promise.allSettled(promises);
  },

  // Invalidate stale distance cache
  invalidateDistanceCache: () => {
    queryClient.invalidateQueries({
      queryKey: ['distances'],
      exact: false,
    });
  },

  // Clear old cache entries
  clearStaleCache: () => {
    queryClient.clear();
    localStorage.removeItem('zaago-distance-cache');
    localStorage.removeItem('zaago-location-cache');
  },

  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    return {
      totalQueries: queries.length,
      freshQueries: queries.filter(q => q.state.dataUpdatedAt > Date.now() - 5 * 60 * 1000).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cacheSize: JSON.stringify(cache).length,
    };
  },
};
