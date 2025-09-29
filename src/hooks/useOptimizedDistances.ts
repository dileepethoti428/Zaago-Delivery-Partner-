import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/react-query-config';

interface LocationCoords {
  lat: number;
  lng: number;
}

interface DistanceResult {
  orderId: string;
  distance: number;
  cached: boolean;
  timestamp: number;
}

interface CachedDistance {
  distance: number;
  timestamp: number;
  agentLocation: LocationCoords;
  orderLocation: LocationCoords;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Distance threshold for cache invalidation (100 meters)
const LOCATION_THRESHOLD = 0.1;

export const useOptimizedDistances = (agentLocation: LocationCoords | null) => {
  const queryClient = useQueryClient();

  // Calculate Haversine distance for cache validation
  const calculateHaversineDistance = useCallback((
    lat1: number, lon1: number, lat2: number, lon2: number
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Check if cached distance is still valid
  const isCacheValid = useCallback((
    cached: CachedDistance,
    currentAgentLocation: LocationCoords
  ): boolean => {
    const now = Date.now();
    const timeDiff = now - cached.timestamp;
    
    // Check time expiration
    if (timeDiff > CACHE_DURATION) return false;
    
    // Check location drift
    const locationDrift = calculateHaversineDistance(
      cached.agentLocation.lat,
      cached.agentLocation.lng,
      currentAgentLocation.lat,
      currentAgentLocation.lng
    );
    
    return locationDrift < LOCATION_THRESHOLD;
  }, [calculateHaversineDistance]);

  // Batch calculate distances for multiple orders
  const calculateBatchDistances = useCallback(async (
    orders: Array<{ id: string; pickup_location?: any }>,
    agentLoc: LocationCoords
  ): Promise<DistanceResult[]> => {
    const cacheKey = 'zaago-distance-cache';
    const cachedData = localStorage.getItem(cacheKey);
    const cache: Record<string, CachedDistance> = cachedData ? JSON.parse(cachedData) : {};
    
    const results: DistanceResult[] = [];
    const ordersToCalculate: Array<{ id: string; pickup_location: any }> = [];

    // Check cache for each order
    for (const order of orders) {
      if (!order.pickup_location) {
        results.push({
          orderId: order.id,
          distance: 2.0, // Default fallback
          cached: false,
          timestamp: Date.now(),
        });
        continue;
      }

      const cached = cache[order.id];
      if (cached && isCacheValid(cached, agentLoc)) {
        results.push({
          orderId: order.id,
          distance: cached.distance,
          cached: true,
          timestamp: cached.timestamp,
        });
      } else if (order.pickup_location) {
        ordersToCalculate.push({ ...order, pickup_location: order.pickup_location });
      }
    }

    // Batch calculate remaining distances
    if (ordersToCalculate.length > 0) {
      try {
        console.log(`📊 Batch calculating distances for ${ordersToCalculate.length} orders`);
        
        // Use batch API or calculate in chunks
        const chunkSize = 10;
        const chunks = [];
        
        for (let i = 0; i < ordersToCalculate.length; i += chunkSize) {
          chunks.push(ordersToCalculate.slice(i, i + chunkSize));
        }

        const chunkResults = await Promise.allSettled(
          chunks.map(chunk => calculateChunkDistances(chunk, agentLoc))
        );

        const newCache = { ...cache };
        
        chunkResults.forEach((result, chunkIndex) => {
          if (result.status === 'fulfilled') {
            result.value.forEach((distanceResult, orderIndex) => {
              const order = chunks[chunkIndex][orderIndex];
              const distance = distanceResult?.distance_km || 2.0;
              
              results.push({
                orderId: order.id,
                distance,
                cached: false,
                timestamp: Date.now(),
              });

              // Cache the result
              newCache[order.id] = {
                distance,
                timestamp: Date.now(),
                agentLocation: { ...agentLoc },
                orderLocation: {
                  lat: order.pickup_location?.lat || 0,
                  lng: order.pickup_location?.lng || 0,
                },
              };
            });
          } else {
            // Handle failed chunk with fallback distances
            chunks[chunkIndex].forEach(order => {
              results.push({
                orderId: order.id,
                distance: 2.0,
                cached: false,
                timestamp: Date.now(),
              });
            });
          }
        });

        // Update cache
        localStorage.setItem(cacheKey, JSON.stringify(newCache));
        
      } catch (error) {
        console.error('❌ Batch distance calculation failed:', error);
        
        // Fallback for failed calculations
        ordersToCalculate.forEach(order => {
          results.push({
            orderId: order.id,
            distance: 2.0,
            cached: false,
            timestamp: Date.now(),
          });
        });
      }
    }

    console.log(`📏 Distance calculation complete: ${results.filter(r => r.cached).length} cached, ${results.filter(r => !r.cached).length} fresh`);
    return results;
  }, [isCacheValid]);

  // Calculate distances for a chunk of orders
  const calculateChunkDistances = async (
    orders: Array<{ id: string; pickup_location: any }>,
    agentLoc: LocationCoords
  ) => {
    const promises = orders.map(async (order) => {
      const { data, error } = await supabase.functions.invoke('calculate-delivery-pricing', {
        body: {
          order_id: order.id,
          agent_location: agentLoc
        }
      });

      if (error) throw error;
      return data;
    });

    return Promise.allSettled(promises).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      )
    );
  };

  // Preload distances for likely needed orders
  const preloadDistances = useCallback(async (orderIds: string[], agentLoc: LocationCoords) => {
    if (!agentLoc) return;

    try {
      const orders = orderIds.map(id => ({ id, pickup_location: { lat: 0, lng: 0 } }));
      await calculateBatchDistances(orders, agentLoc);
      console.log(`📋 Preloaded distances for ${orderIds.length} orders`);
    } catch (error) {
      console.error('❌ Distance preloading failed:', error);
    }
  }, [calculateBatchDistances]);

  // Clear stale cache entries
  const clearStaleCache = useCallback(() => {
    const cacheKey = 'zaago-distance-cache';
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return;

    try {
      const cache: Record<string, CachedDistance> = JSON.parse(cachedData);
      const now = Date.now();
      const freshCache: Record<string, CachedDistance> = {};

      Object.entries(cache).forEach(([orderId, cached]) => {
        if (now - cached.timestamp < CACHE_DURATION) {
          freshCache[orderId] = cached;
        }
      });

      localStorage.setItem(cacheKey, JSON.stringify(freshCache));
      console.log(`🧹 Cache cleanup: removed ${Object.keys(cache).length - Object.keys(freshCache).length} stale entries`);
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      localStorage.removeItem(cacheKey);
    }
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    const cacheKey = 'zaago-distance-cache';
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return { total: 0, fresh: 0, stale: 0 };

    try {
      const cache: Record<string, CachedDistance> = JSON.parse(cachedData);
      const now = Date.now();
      
      const entries = Object.values(cache);
      const fresh = entries.filter(entry => now - entry.timestamp < CACHE_DURATION).length;
      
      return {
        total: entries.length,
        fresh,
        stale: entries.length - fresh,
      };
    } catch {
      return { total: 0, fresh: 0, stale: 0 };
    }
  }, []);

  return {
    calculateBatchDistances,
    preloadDistances,
    clearStaleCache,
    getCacheStats,
  };
};