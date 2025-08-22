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

    // Start transaction by updating order status back to placed and removing agent assignment
    const { data: orderUpdate, error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'placed',  // Set back to 'placed' so other agents can see it
        agent_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('agent_id', agent_id) // Ensure only the assigned agent can cancel
      .select()
      .single();

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

    if (!orderUpdate) {
      console.error('Order not found or not assigned to this agent');
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Log the cancellation for tracking
    const { error: logError } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: order_id,
        agent_id: agent_id,
        action: 'cancelled',
        details: {
          reason: cancellation_reason || 'Agent cancelled delivery',
          cancelled_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('Failed to log cancellation:', logError);
      // Don't fail the request for logging errors
    }

    // Add order exclusion to prevent agent from seeing this order again
    const { error: exclusionError } = await supabase
      .from('order_exclusions')
      .insert({
        order_id: order_id,
        agent_id: agent_id,
        reason: cancellation_reason || 'Agent cancelled delivery'
      });

    if (exclusionError) {
      console.warn('Failed to log order exclusion:', exclusionError);
      // Don't fail the request for exclusion errors
    }

    console.log('Delivery cancelled successfully for order:', order_id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Delivery cancelled successfully',
        order: orderUpdate
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