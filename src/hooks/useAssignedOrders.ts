import { useQuery } from '@tanstack/react-query';
import { fetchAssignedOrders, type AssignedOrder } from '@/services/assignedOrders';

export function useAssignedOrders() {
  return useQuery<AssignedOrder[], Error>({
    queryKey: ['assigned-orders'],
    queryFn: fetchAssignedOrders,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
