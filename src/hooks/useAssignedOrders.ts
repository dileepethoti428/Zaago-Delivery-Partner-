import { useQuery } from '@tanstack/react-query';
import { fetchAssignedOrders, type AssignedOrder } from '@/services/assignedOrders';

export function useAssignedOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders'],
    queryFn: async () => {
      console.log('[useAssignedOrders] Query function called');
      const orders = await fetchAssignedOrders();
      console.log('[useAssignedOrders] Received orders:', orders.length);
      console.log('[useAssignedOrders] Orders data:', orders);
      return orders;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
