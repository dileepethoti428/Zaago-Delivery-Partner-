import { useQuery } from '@tanstack/react-query';
import { getOrderDetails } from '@/services/orderDetails';

export const useOrderDetails = (orderId?: string) => {
  return useQuery({
    queryKey: ['orderDetails', orderId],
    queryFn: () => getOrderDetails(orderId!),
    enabled: !!orderId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
};
