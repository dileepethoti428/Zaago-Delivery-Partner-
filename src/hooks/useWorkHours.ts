import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchTotalHours(userId: string): Promise<number> {
  // Resolve internal agent PK from auth UUID
  const { data: agent, error: agentErr } = await supabase
    .from('delivery_agents')
    .select('id')
    .eq('agent_id', userId)
    .maybeSingle();

  if (agentErr) throw agentErr;
  if (!agent?.id) return 0;

  const { data, error } = await supabase.rpc('get_agent_total_hours', {
    agent_uuid: agent.id,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export function useWorkHours(userId?: string, isOnline?: boolean) {
  return useQuery({
    queryKey: ['work-hours', userId],
    queryFn: () => fetchTotalHours(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    // While online, keep the live counter ticking
    refetchInterval: isOnline ? 60_000 : false,
  });
}

export function formatHours(hours: number): string {
  if (!hours || hours <= 0) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h 0m`;
  return `${h}h ${m}m`;
}
