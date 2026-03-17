import { useQuery } from '@tanstack/react-query';
import { fetchAgentProfile, fetchAgentProfileById } from '@/services/agentProfile';

export const useProfileById = (userId?: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchAgentProfileById(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });
};

export const useProfile = (email?: string) => {
  return useQuery({
    queryKey: ['profile', email],
    queryFn: () => fetchAgentProfile(email!),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });
};
