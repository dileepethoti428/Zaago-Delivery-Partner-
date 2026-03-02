import { useQuery } from '@tanstack/react-query';
import { fetchLiveEarnings, type LiveEarningsData } from '@/services/earnings';
import { useAuthStore } from '@/store/auth';

export const useEarnings = () => {
  const session = useAuthStore((s) => s.session);
  return useQuery<LiveEarningsData>({
    queryKey: ['earnings'],
    queryFn: fetchLiveEarnings,
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
};
