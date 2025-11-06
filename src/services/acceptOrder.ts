import { supabase } from '@/integrations/supabase/client';

export async function acceptOrder(orderId: string, agentId: string) {
  const { data, error } = await supabase.functions.invoke('accept-order', {
    body: {
      order_id: orderId,
      agent_id: agentId,
    },
  });

  if (error) {
    console.error('Error accepting order:', error);
    throw new Error(error.message || 'Failed to accept order');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to accept order');
  }

  return data;
}

export async function rejectOrder(orderId: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'open' })
    .eq('id', orderId);

  if (error) {
    console.error('Error rejecting order:', error);
    throw new Error('Failed to reject order');
  }

  return { success: true };
}
