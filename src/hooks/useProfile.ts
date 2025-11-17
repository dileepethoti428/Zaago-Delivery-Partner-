import { useQuery } from '@tanstack/react-query';
import { fetchAgentProfile } from '@/services/agentProfile';

export const useProfile = (email?: string) => {
  return useQuery({
    queryKey: ['profile', email],
    queryFn: () => fetchAgentProfile(email!),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
