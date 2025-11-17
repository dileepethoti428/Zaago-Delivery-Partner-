import { useQuery } from '@tanstack/react-query';
import { fetchLiveEarnings, type LiveEarningsData } from '@/services/earnings';

export const useEarnings = () => {
  return useQuery<LiveEarningsData>({
    queryKey: ['earnings'],
    queryFn: fetchLiveEarnings,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
};
