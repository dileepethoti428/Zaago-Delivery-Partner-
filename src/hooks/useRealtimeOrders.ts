import { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/react-query-config';
import { useBackgroundSync } from './useBackgroundSync';
import { calculateRealTimeDistance, getAgentLocationFromStorage, extractCoordinatesFromAddress } from '@/lib/distanceService';

interface RealtimeOrder {
  id: string;
  status: string;
  items: any[];
  total: number;
  customer_name: string;
  customer_phone: string;
  address: any;
  pickup_location: any;
  delivery_time_slot: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export const useRealtimeOrders = (agentId: string | null) => {
  const queryClient = useQueryClient();
  const { isOnline, queueAction } = useBackgroundSync();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  // WebSocket connection for real-time updates - optimized with debouncing
  useEffect(() => {
    if (!agentId || !isOnline) {
      console.log('⏸️ Skipping real-time connection - agentId:', !!agentId, 'isOnline:', isOnline);
      return;
    }

    console.log('🔌 Establishing real-time connection for orders');
    
    let debounceTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    // Debounce function for batch updates
    const debouncedUpdate = (callback: () => void) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, 100); // 100ms debounce
    };
    
    // Listen to INSERT events for new orders (placed status only)
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.placed`
        },
        async (payload) => {
          const newOrder = payload.new as any;
          console.log('📦 Real-time new order:', newOrder?.id, 'status:', newOrder?.status);
          
          // If order is delivered, remove it from available orders
          if (newOrder?.status === 'delivered') {
            console.log('✅ Order delivered, removing from cache:', newOrder.id);
            debouncedUpdate(() => {
              queryClient.setQueryData(
                queryKeys.availableOrders(agentId, { lat: 0, lng: 0 }),
                (oldData: any) => {
                  if (!oldData) return oldData;
                  return oldData.filter((order: any) => order.id !== newOrder.id);
                }
              );
              setLastUpdate(new Date());
              setUpdateCount(prev => prev + 1);
            });
            return;
          }
          
          // ✅ Validate distance before adding to cache
          const agentLocation = getAgentLocationFromStorage();
          
          if (agentLocation && newOrder.delivery_address) {
            try {
              const customerLocation = extractCoordinatesFromAddress(newOrder.delivery_address);
              
              if (customerLocation) {
                const distanceResult = await calculateRealTimeDistance(
                  agentLocation,
                  customerLocation,
                  newOrder.id
                );
                
                // Only add if within 15km
                if (distanceResult.distance_km > 15) {
                  console.log(`❌ Order ${newOrder.id} is ${distanceResult.distance_km.toFixed(2)}km away - filtering out (>15km)`);
                  return; // Don't add to cache
                }
                
                console.log(`✅ Order ${newOrder.id} is ${distanceResult.distance_km.toFixed(2)}km away - adding to cache`);
              }
            } catch (error) {
              console.warn('⚠️ Failed to validate order distance, including by default:', error);
            }
          }
          
          // Add new order to cache with debouncing
          debouncedUpdate(() => {
            queryClient.setQueryData(
              queryKeys.availableOrders(agentId, { lat: 0, lng: 0 }),
              (oldData: any) => {
                if (!oldData) return oldData;
                const newOrder = payload.new as RealtimeOrder;
                // Prevent duplicates
                if (oldData.some((o: any) => o.id === newOrder.id)) {
                  console.log('📦 Order already in cache, skipping:', newOrder.id);
                  return oldData;
                }
                return [newOrder, ...oldData];
              }
            );
            setLastUpdate(new Date());
            setUpdateCount(prev => prev + 1);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `status=in.(packed,confirmed)`
        },
        (payload) => {
          const updatedOrder = payload.new as any;
          console.log('📦 Real-time order update:', updatedOrder?.id, 'status:', updatedOrder?.status);
          
          // Update existing order in cache
          queryClient.setQueryData(
            queryKeys.availableOrders(agentId, { lat: 0, lng: 0 }),
            (oldData: any) => {
              if (!oldData) return oldData;
              
              const existingIndex = oldData.findIndex((order: any) => order.id === updatedOrder.id);
              if (existingIndex >= 0) {
                const updatedData = [...oldData];
                updatedData[existingIndex] = { ...updatedData[existingIndex], ...updatedOrder };
                return updatedData;
              }
              return oldData;
            }
          );
          
          setLastUpdate(new Date());
          setUpdateCount(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        
        // Handle connection failures with exponential backoff
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reconnectAttempts++;
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            return;
          }
          
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`⏳ Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0; // Reset on successful connection
        }
      });

    return () => {
      console.log('🔌 Cleaning up real-time connection');
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [agentId, queryClient, isOnline]);

  // Fetch available orders with caching
  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.availableOrders(agentId || '', { lat: 0, lng: 0 }),
    queryFn: async () => {
      if (!agentId) return [];
      
      console.log('🔄 Fetching available orders for agent:', agentId);
      
      const { data, error } = await supabase.functions.invoke('get-available-orders', {
        body: { agent_id: agentId }
      });

      if (error) {
        console.error('❌ Failed to fetch available orders:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} available orders`);
      return data || [];
    },
    enabled: !!agentId && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: false, // Disabled - real-time subscriptions handle updates
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!isOnline) return false;
      return failureCount < 3;
    },
  });

  // Accept order with optimistic updates and offline support
  const acceptOrder = useCallback(async (orderId: string) => {
    console.log('📋 Accepting order:', orderId);

    if (!agentId) {
      throw new Error('Agent ID not available');
    }

    // Optimistic update - remove order from list immediately
    queryClient.setQueryData(
      queryKeys.availableOrders(agentId, { lat: 0, lng: 0 }),
      (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((order: any) => order.id !== orderId);
      }
    );

    const actionData = {
      order_id: orderId,
      agent_id: agentId,
    };

    try {
      if (isOnline) {
        // Execute immediately if online
        const { data, error } = await supabase.functions.invoke('accept-order', {
          body: actionData
        });

        if (error) throw error;
        
        console.log('✅ Order accepted successfully:', orderId);
        
        // Refresh orders to get updated data
        setTimeout(() => refetch(), 1000);
        
        return data;
      } else {
        // Queue for background sync if offline
        const queued = await queueAction({
          type: 'accept_order',
          data: actionData,
        });

        if (!queued) {
          throw new Error('Failed to queue order acceptance');
        }

        console.log('📝 Order acceptance queued for background sync:', orderId);
        return { queued: true };
      }
    } catch (error) {
      console.error('❌ Failed to accept order:', error);
      
      // Revert optimistic update on error
      queryClient.invalidateQueries({
        queryKey: queryKeys.availableOrders(agentId, { lat: 0, lng: 0 })
      });
      
      throw error;
    }
  }, [agentId, isOnline, queueAction, queryClient, refetch]);

  // Manual refresh with loading state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const refreshOrders = useCallback(async () => {
    if (!agentId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refetch();
      console.log('🔄 Orders refreshed manually');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [agentId, isRefreshing, refetch]);

  // Get cached order count
  const getCachedOrderCount = useCallback(() => {
    const cachedData = queryClient.getQueryData(
      queryKeys.availableOrders(agentId || '', { lat: 0, lng: 0 })
    );
    return Array.isArray(cachedData) ? cachedData.length : 0;
  }, [agentId, queryClient]);

  return {
    orders,
    isLoading,
    error,
    isRefreshing,
    lastUpdate,
    updateCount,
    isOnline,
    acceptOrder,
    refreshOrders,
    getCachedOrderCount,
  };
};