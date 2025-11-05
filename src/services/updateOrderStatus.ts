import { supabase } from '@/integrations/supabase/client';

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId);

  if (error) throw error;
}
