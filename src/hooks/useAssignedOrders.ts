import { useQuery } from '@tanstack/react-query';
import { 
  fetchTodayOrders, 
  fetchTomorrowOrders, 
  fetchUpcomingOrders,
  fetchDeliveredOrders,
  fetchAssignedOrders,
  type AssignedOrder 
} from '@/services/assignedOrders';
import { useAuthStore } from '@/store/auth';

// Hook for TODAY's orders (uses IST-aware date from Postgres)
export function useTodayOrders() {
  const session = useAuthStore((s) => s.session);
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'today'],
    queryFn: async () => {
      console.log('[useTodayOrders] Fetching via RPC...');
      const orders = await fetchTodayOrders();
      console.log('[useTodayOrders] Received:', orders.length, 'orders');
      return orders;
    },
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });
}

// Hook for TOMORROW's orders (uses Postgres CURRENT_DATE + 1)
export function useTomorrowOrders() {
  const session = useAuthStore((s) => s.session);
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'tomorrow'],
    queryFn: async () => {
      console.log('[useTomorrowOrders] Fetching via RPC...');
      const orders = await fetchTomorrowOrders();
      console.log('[useTomorrowOrders] Received:', orders.length, 'orders');
      return orders;
    },
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });
}

// Hook for UPCOMING orders (uses Postgres CURRENT_DATE + 1)
export function useUpcomingOrders() {
  const session = useAuthStore((s) => s.session);
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'upcoming'],
    queryFn: async () => {
      console.log('[useUpcomingOrders] Fetching via RPC...');
      const orders = await fetchUpcomingOrders();
      console.log('[useUpcomingOrders] Received:', orders.length, 'orders');
      return orders;
    },
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });
}

// Hook for DELIVERED orders today (uses Postgres CURRENT_DATE)
export function useDeliveredOrders() {
  const session = useAuthStore((s) => s.session);
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'delivered'],
    queryFn: async () => {
      console.log('[useDeliveredOrders] Fetching via RPC...');
      const orders = await fetchDeliveredOrders();
      console.log('[useDeliveredOrders] Received:', orders.length, 'orders');
      return orders;
    },
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });
}

// Legacy hook - kept for backward compatibility
export function useAssignedOrders() {
  const session = useAuthStore((s) => s.session);
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders', 'all'],
    queryFn: async () => {
      console.log('[useAssignedOrders] Query function called');
      const orders = await fetchAssignedOrders();
      console.log('[useAssignedOrders] Received orders:', orders.length);
      return orders;
    },
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });
}
