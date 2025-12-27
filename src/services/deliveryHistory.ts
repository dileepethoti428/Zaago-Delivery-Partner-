import { supabase } from '@/integrations/supabase/client';

export interface DeliveryHistoryItem {
  id: string;
  order_id: string;
  agent_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: any;
  items: any;
  total_amount: number | null;
  delivery_payout: number | null;
  payment_status: string | null;
  payment_method: string | null;
  delivery_date: string | null;
  completed_at: string;
  delivery_duration: number | null;
  distance_traveled: number | null;
  customer_rating: number | null;
  delivery_notes: string | null;
  delivery_proof: any;
}

export interface DeliveryHistoryResponse {
  data: DeliveryHistoryItem[];
  count: number;
}

export async function fetchDeliveryHistory(
  limit = 20,
  offset = 0,
  paymentStatus?: 'paid' | 'pending' | null
): Promise<DeliveryHistoryResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (paymentStatus) {
    params.append('payment_status', paymentStatus);
  }

  const { data, error } = await supabase.functions.invoke('get-delivery-history', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (error) {
    console.error('Error fetching delivery history:', error);
    throw error;
  }

  return data as DeliveryHistoryResponse;
}

export function formatDeliveryDate(dateString: string): string {
  const IST_TIMEZONE = 'Asia/Kolkata';
  const date = new Date(dateString);
  
  // Get today and yesterday in IST
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIST = yesterdayDate.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  
  // Get the date in IST for comparison
  const dateIST = date.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });

  if (dateIST === todayIST) return 'Today';
  if (dateIST === yesterdayIST) return 'Yesterday';
  
  // Calculate days difference
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 7 && diffDays > 0) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-IN', { 
    timeZone: IST_TIMEZONE,
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

export function formatDeliveryTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}
