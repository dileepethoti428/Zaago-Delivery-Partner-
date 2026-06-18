import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DistanceBreakdown {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  allTime: number;
}

const EMPTY: DistanceBreakdown = {
  today: 0,
  yesterday: 0,
  week: 0,
  month: 0,
  allTime: 0,
};

async function fetchBreakdown(userId: string): Promise<DistanceBreakdown> {
  const { data: agent, error: agentErr } = await supabase
    .from('delivery_agents')
    .select('id')
    .eq('agent_id', userId)
    .maybeSingle();

  if (agentErr) throw agentErr;
  if (!agent?.id) return EMPTY;

  const { data, error } = await supabase.rpc('get_agent_distance_breakdown', {
    agent_uuid: agent.id,
  });

  if (error) throw error;

  const d = (data ?? {}) as Record<string, number>;
  return {
    today: Number(d.today ?? 0),
    yesterday: Number(d.yesterday ?? 0),
    week: Number(d.week ?? 0),
    month: Number(d.month ?? 0),
    allTime: Number(d.all_time ?? 0),
  };
}

export function useDistanceCovered(userId?: string, isOnline?: boolean) {
  return useQuery({
    queryKey: ['distance-covered-breakdown', userId],
    queryFn: () => fetchBreakdown(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: isOnline ? 60_000 : false,
  });
}

export function formatKm(km: number): string {
  if (!km || km <= 0) return '0 km';
  return `${km.toFixed(1)} km`;
}
