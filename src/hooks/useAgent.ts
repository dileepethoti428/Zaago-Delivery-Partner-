import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Agent {
  id: string;
  name: string;
  email: string;
}

/**
 * Shared cached hook for agent data
 * Fetches once, caches for 15 minutes, shares across all components
 * Eliminates duplicate agent fetches on every page
 */
export const useAgent = () => {
  return useQuery({
    queryKey: ['agent'],
    queryFn: async (): Promise<Agent | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;

      const { data: agentData, error } = await supabase
        .from('delivery_agents')
        .select('id, name, email')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching agent:', error);
        return null;
      }

      return agentData;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - agent data rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false, // Don't refetch when window gets focus
    retry: 2,
  });
};
