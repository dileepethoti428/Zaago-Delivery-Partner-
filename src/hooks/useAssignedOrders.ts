import { useQuery } from '@tanstack/react-query';
import { 
  fetchTodayOrders, 
  fetchTomorrowOrders, 
  fetchUpcomingOrders,
  fetchAssignedOrders,
  type AssignedOrder 
} from '@/services/assignedOrders';

// Hook for TODAY's orders (uses IST-aware date from Postgres)
export function useTodayOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'today'],
    queryFn: async () => {
      console.log('[useTodayOrders] Fetching via RPC...');
      const orders = await fetchTodayOrders();
      console.log('[useTodayOrders] Received:', orders.length, 'orders');
      return orders;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook for TOMORROW's orders (uses Postgres CURRENT_DATE + 1)
export function useTomorrowOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'tomorrow'],
    queryFn: async () => {
      console.log('[useTomorrowOrders] Fetching via RPC...');
      const orders = await fetchTomorrowOrders();
      console.log('[useTomorrowOrders] Received:', orders.length, 'orders');
      return orders;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook for UPCOMING orders (uses Postgres CURRENT_DATE + 1)
export function useUpcomingOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'upcoming'],
    queryFn: async () => {
      console.log('[useUpcomingOrders] Fetching via RPC...');
      const orders = await fetchUpcomingOrders();
      console.log('[useUpcomingOrders] Received:', orders.length, 'orders');
      return orders;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Legacy hook - kept for backward compatibility
export function useAssignedOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'all'],
    queryFn: async () => {
      console.log('[useAssignedOrders] Query function called');
      const orders = await fetchAssignedOrders();
      console.log('[useAssignedOrders] Received orders:', orders.length);
      return orders;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
