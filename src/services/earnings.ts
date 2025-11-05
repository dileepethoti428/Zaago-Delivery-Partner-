import { supabase } from '@/integrations/supabase/client';

export async function fetchAgentEarnings(agentId: string) {
  const { data, error } = await supabase
    .from('agent_earnings_tracking')
    .select('expected_payout, created_at, agent_id')
    .eq('agent_id', agentId);

  if (error) throw error;
  return data || [];
}

export function computeEarningsTotals(rows: { expected_payout: number | null; created_at: string }[]) {
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  let today = 0;
  let week = 0;
  let month = 0;

  rows.forEach(r => {
    const d = new Date(r.created_at);
    const amt = Number(r.expected_payout) || 0;

    if (r.created_at.startsWith(todayStr)) {
      today += amt;
    }

    if (d >= weekStart) {
      week += amt;
    }

    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      month += amt;
    }
  });

  return { today, week, month };
}
