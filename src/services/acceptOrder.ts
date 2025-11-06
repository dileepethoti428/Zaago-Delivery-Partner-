import { supabase } from '@/integrations/supabase/client';

export async function acceptOrder(orderId: string, agentId: string) {
  // Validate inputs
  if (!orderId || !agentId) {
    console.error('❌ Accept order validation failed:', { orderId, agentId });
    throw new Error(orderId ? 'Agent ID missing' : 'Order ID missing');
  }

  console.log('📤 Accepting order:', { order_id: orderId, agent_id: agentId });

  const { data, error } = await supabase.functions.invoke('accept-order', {
    body: {
      order_id: orderId,
      agent_id: agentId,
    },
  });

  console.log('📥 Accept order response:', { 
    data, 
    error,
    hasData: !!data,
    hasError: !!error 
  });

  if (error) {
    console.error('❌ Error accepting order:', error);
    throw new Error(error.message || 'Failed to accept order');
  }

  if (!data?.success) {
    console.error('❌ Order acceptance failed:', data);
    throw new Error(data?.error || 'Failed to accept order');
  }

  console.log('✅ Order accepted successfully');
  return data;
}

export async function rejectOrder(orderId: string, agentId: string) {
  // Validate inputs
  if (!orderId || !agentId) {
    console.error('❌ Reject order validation failed:', { orderId, agentId });
    throw new Error(orderId ? 'Agent ID missing' : 'Order ID missing');
  }

  console.log('📤 Rejecting order:', { order_id: orderId, agent_id: agentId });

  const { data, error } = await supabase.functions.invoke('cancel-delivery', {
    body: {
      order_id: orderId,
      agent_id: agentId,
      cancellation_reason: 'Agent rejected order'
    },
  });

  console.log('📥 Reject order response:', { 
    data, 
    error,
    hasData: !!data,
    hasError: !!error 
  });

  if (error) {
    console.error('❌ Error rejecting order:', error);
    throw new Error(error.message || 'Failed to reject order');
  }

  if (!data?.success) {
    console.error('❌ Order rejection failed:', data);
    throw new Error(data?.error || 'Failed to reject order');
  }

  console.log('✅ Order rejected successfully');
  return data;
}
