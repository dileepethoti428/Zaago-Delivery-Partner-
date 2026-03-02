import { supabase } from '@/integrations/supabase/client';

/**
 * Payout breakdown for transparent Zepto/Blinkit style pricing
 */
export interface PayoutBreakdown {
  base_pay: number;      // Fixed ₹10 per order
  distance_pay: number;  // distance_km × ₹8
  distance_km: number;   // Actual distance rounded to 1 decimal
  rate_per_km: number;   // ₹8 per km
}

// Period earnings breakdown
export interface PeriodEarnings {
  pending: number;
  confirmed: number;
  total: number;
  deliveries: number;
  in_progress: number;
  cancelled: number;
  total_orders: number;
}

// Individual earning record
export interface EarningRecord {
  order_id: string | null;
  daily_order_id?: string | null;
  accepted_at: string;
  completed_at: string | null;
  expected_payout: number;
  actual_payout: number | null;
  status: string;
  distance_km: number;
  is_peak_hour: boolean;
  payout_breakdown?: PayoutBreakdown;
  subscription_id?: string | null;
  order_type: 'regular' | 'subscription';
}

// Earnings by order type
export interface EarningsByType {
  today: PeriodEarnings;
  week: PeriodEarnings;
  month: PeriodEarnings;
  recent_earnings: EarningRecord[];
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  if (amount === 0) return '₹0';
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
  
  const todayIST = now.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const currentMonthIST = parseInt(now.toLocaleDateString('en-CA', { 
    timeZone: IST_TIMEZONE, 
    month: 'numeric' 
  })) - 1;
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

    const rowDateIST = d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
    const rowMonthIST = parseInt(d.toLocaleDateString('en-CA', { 
      timeZone: IST_TIMEZONE, 
      month: 'numeric' 
    })) - 1;
    const rowYearIST = parseInt(d.toLocaleDateString('en-CA', { 
      timeZone: IST_TIMEZONE, 
      year: 'numeric' 
    }));

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
