import { useQuery } from '@tanstack/react-query';
import { fetchDeliveryHistory } from '@/services/deliveryHistory';

export const useDeliveryHistory = (limit = 20, offset = 0, paymentStatus?: 'paid' | 'pending' | null, isScreenActive = false) => {
  return useQuery({
    queryKey: ['deliveryHistory', limit, offset, paymentStatus],
    queryFn: () => fetchDeliveryHistory(limit, offset, paymentStatus),
    enabled: isScreenActive,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
