import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth';
import type { PeriodEarnings } from '@/services/earnings';

export const useAllTimeEarnings = () => {
  const user = useAuthStore((s) => s.user);

  return useQuery<PeriodEarnings>({
    queryKey: ['all-time-earnings', user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Step 1: Resolve the internal delivery_agents.id from auth user UUID
      const { data: agentRow, error: agentError } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('agent_id', user!.id)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agentRow) return { total: 0, confirmed: 0, pending: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 };

      // Step 2: Query earnings using internal delivery_agents.id
      const { data, error } = await supabase
        .from('agent_earnings_tracking')
        .select('expected_payout, actual_payout, payout_status')
        .eq('agent_id', agentRow.id);

      if (error) throw error;

      const rows = data || [];
      let total = 0;
      let confirmed = 0;
      let pending = 0;
      let deliveries = 0;
      let in_progress = 0;
      let cancelled = 0;

      for (const r of rows) {
        const status = r.payout_status ?? '';
        const expected = parseFloat(String(r.expected_payout ?? 0));
        const actual = parseFloat(String(r.actual_payout ?? 0));

        if (status === 'confirmed') {
          confirmed += actual || expected;
          total += actual || expected;
          deliveries++;
        } else if (status === 'pending') {
          pending += expected;
          total += expected;
          in_progress++;
        } else if (status === 'cancelled') {
          cancelled++;
        }
      }

      return { total, confirmed, pending, deliveries, in_progress, cancelled, total_orders: rows.length };
    },
  });
};
