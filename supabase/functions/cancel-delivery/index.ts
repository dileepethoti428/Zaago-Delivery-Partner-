import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Cancel delivery function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { order_id, agent_id, cancellation_reason } = await req.json();
    console.log('Processing cancellation for order:', order_id, 'agent:', agent_id);

    if (!order_id || !agent_id) {
      console.error('Missing required fields:', { order_id, agent_id });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Determine if this is a rejection (unassigned order) or cancellation (assigned to this agent)
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, agent_id, status')
      .eq('id', order_id)
      .maybeSingle();

    if (fetchError || !order) {
      console.error('Order not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    if (!order.agent_id) {
      // Unassigned -> agent is rejecting the order. Do not change order status.
      const { error: rejectionError } = await supabase
        .from('agent_order_rejections')
        .insert({
          order_id,
          agent_id,
          rejection_reason: cancellation_reason || 'Agent rejected delivery',
          rejection_type: 'manual'
        });

      if (rejectionError) {
        console.warn('Failed to record order rejection:', rejectionError);
      } else {
        console.log(`Agent ${agent_id} rejected order ${order_id}`);
      }

      // Log rejection
      const { error: logError } = await supabase
        .from('delivery_logs')
        .insert({
          order_id,
          agent_id,
          action: 'rejected',
          details: {
            reason: cancellation_reason || 'Agent rejected delivery',
            rejected_at: new Date().toISOString()
          }
        });

      if (logError) {
        console.warn('Failed to log rejection:', logError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Order rejected successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // If assigned to a different agent, reject the request
    if (order.agent_id !== agent_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order is assigned to another agent' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    // Assigned to this agent -> cancel and release back to pool
    const { data: updated, error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'packed',
        agent_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('agent_id', agent_id)
      .select();

    if (orderError) {
      console.error('Failed to update order:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to cancel delivery' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    if (!updated || updated.length === 0) {
      console.error('Order not found or not assigned to this agent');
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Log the cancellation
    const { error: logError } = await supabase
      .from('delivery_logs')
      .insert({
        order_id,
        agent_id,
        action: 'cancelled',
        details: {
          reason: cancellation_reason || 'Agent cancelled delivery',
          cancelled_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('Failed to log cancellation:', logError);
    }

    // Record rejection to avoid showing it again to this agent
    const { error: rejectionError2 } = await supabase
      .from('agent_order_rejections')
      .insert({
        order_id,
        agent_id,
        rejection_reason: cancellation_reason || 'Agent cancelled delivery',
        rejection_type: 'cancelled'
      });

    if (rejectionError2) {
      console.warn('Failed to record order rejection:', rejectionError2);
    } else {
      console.log(`Agent ${agent_id} cancelled order ${order_id} - will not see it again`);
    }

    console.log('Delivery cancelled successfully for order:', order_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery cancelled successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error in cancel-delivery:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});