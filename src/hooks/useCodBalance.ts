import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface SellerBreakdown {
  seller_id: string;
  seller_name: string;
  pending_amount: number;
  order_count: number;
}

interface CodBalanceData {
  total_pending: number;
  seller_breakdown: SellerBreakdown[];
}

async function fetchCodBalance(): Promise<CodBalanceData> {
  // Get current user's agent ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: agent } = await supabase
    .from('delivery_agents')
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle();

  if (!agent) throw new Error('Agent not found');

  // Fetch pending COD settlements
  const { data: settlements, error } = await supabase
    .from('cod_settlements')
    .select('seller_id, amount')
    .eq('agent_id', agent.id)
    .eq('status', 'pending');

  if (error) throw error;

  // Group by seller
  const sellerMap: Record<string, { total: number; count: number }> = {};
  let grandTotal = 0;

  for (const s of (settlements || [])) {
    if (!sellerMap[s.seller_id]) {
      sellerMap[s.seller_id] = { total: 0, count: 0 };
    }
    sellerMap[s.seller_id].total += s.amount;
    sellerMap[s.seller_id].count += 1;
    grandTotal += s.amount;
  }

  // Fetch seller names
  const sellerIds = Object.keys(sellerMap);
  let sellerNames: Record<string, string> = {};

  if (sellerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles' as any)
      .select('id, full_name, business_name')
      .in('id', sellerIds);

    if (profiles) {
      for (const p of profiles as any[]) {
        sellerNames[p.id] = p.business_name || p.full_name || 'Seller';
      }
    }
  }

  return {
    total_pending: grandTotal,
    seller_breakdown: Object.entries(sellerMap).map(([sid, data]) => ({
      seller_id: sid,
      seller_name: sellerNames[sid] || 'Seller',
      pending_amount: data.total,
      order_count: data.count,
    })),
  };
}

export function useCodBalance() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cod-balance'],
    queryFn: fetchCodBalance,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: subscribe to cod_settlements changes to auto-refresh
  useEffect(() => {
    const channel = supabase
      .channel('cod-settlements-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cod_settlements' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cod-balance'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
