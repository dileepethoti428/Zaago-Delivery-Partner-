import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkHoursBreakdown {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  allTime: number;
}

const EMPTY: WorkHoursBreakdown = {
  today: 0,
  yesterday: 0,
  week: 0,
  month: 0,
  allTime: 0,
};

async function fetchBreakdown(userId: string): Promise<WorkHoursBreakdown> {
  const { data: agent, error: agentErr } = await supabase
    .from('delivery_agents')
    .select('id')
    .eq('agent_id', userId)
    .maybeSingle();

  if (agentErr) throw agentErr;
  if (!agent?.id) return EMPTY;

  const { data, error } = await supabase.rpc('get_agent_work_hours_breakdown', {
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

export function useWorkHours(userId?: string, isOnline?: boolean) {
  return useQuery({
    queryKey: ['work-hours-breakdown', userId],
    queryFn: () => fetchBreakdown(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
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
