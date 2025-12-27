import { supabase } from '@/integrations/supabase/client';

// Earnings data service
export interface LiveEarningsData {
  today: {
    pending: number;
    confirmed: number;
    total: number;
    deliveries: number;
    in_progress: number;
    cancelled: number;
    total_orders: number;
  };
  week: {
    pending: number;
    confirmed: number;
    total: number;
    deliveries: number;
    in_progress: number;
    cancelled: number;
    total_orders: number;
  };
  month: {
    pending: number;
    confirmed: number;
    total: number;
    deliveries: number;
    in_progress: number;
    cancelled: number;
    total_orders: number;
  };
  recent_earnings: any[];
  live_payout: number;
  deliveries_in_progress: number;
}

export async function fetchLiveEarnings(): Promise<LiveEarningsData> {
  const { data, error } = await supabase.functions.invoke('get-agent-live-earnings', {
    method: 'POST'
  });

  if (error) {
    console.error('Error fetching live earnings:', error);
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to fetch earnings');
  }

  return data.data;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (!amount || amount === 0) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export async function fetchAgentEarnings(agentId: string) {
  const { data, error } = await supabase
    .from('agent_earnings_tracking')
    .select('expected_payout, created_at, agent_id')
    .eq('agent_id', agentId);

  if (error) throw error;
  return data || [];
}

export function computeEarningsTotals(rows: { expected_payout: number | null; created_at: string }[]) {
  const IST_TIMEZONE = 'Asia/Kolkata';
  const now = new Date();
  
  // Get today's date in IST for accurate comparison
  const todayIST = now.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });

  // Calculate week start in IST
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  // Get current month/year in IST
  const currentMonthIST = parseInt(now.toLocaleDateString('en-CA', { 
    timeZone: IST_TIMEZONE, 
    month: 'numeric' 
  })) - 1; // 0-indexed
  const currentYearIST = parseInt(now.toLocaleDateString('en-CA', { 
    timeZone: IST_TIMEZONE, 
    year: 'numeric' 
  }));

  let today = 0;
  let week = 0;
  let month = 0;

  rows.forEach(r => {
    const d = new Date(r.created_at);
    const amt = Number(r.expected_payout) || 0;

    // Get the row's date in IST for comparison
    const rowDateIST = d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
    const rowMonthIST = parseInt(d.toLocaleDateString('en-CA', { 
      timeZone: IST_TIMEZONE, 
      month: 'numeric' 
    })) - 1;
    const rowYearIST = parseInt(d.toLocaleDateString('en-CA', { 
      timeZone: IST_TIMEZONE, 
      year: 'numeric' 
    }));

    // Compare dates in IST
    if (rowDateIST === todayIST) {
      today += amt;
    }

    if (d >= weekStart) {
      week += amt;
    }

    if (rowMonthIST === currentMonthIST && rowYearIST === currentYearIST) {
      month += amt;
    }
  });

  return { today, week, month };
}
