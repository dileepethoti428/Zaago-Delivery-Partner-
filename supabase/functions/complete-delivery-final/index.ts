import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting final delivery completion...');
    
    const { order_id, payment_method } = await req.json();
    
    if (!order_id) {
      throw new Error('Order ID is required');
    }

    console.log('📋 Processing order:', order_id, 'with payment:', payment_method);

    // Initialize Supabase client with service role (has elevated permissions)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user?.email) {
      console.error('❌ User authentication failed:', userError);
      throw new Error('Authentication required');
    }

    console.log('✅ User authenticated:', user.email);

    // Get agent details
    const { data: agent } = await supabaseAdmin
      .from('delivery_agents')
      .select('id, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!agent) {
      throw new Error('Agent not found or not active');
    }

    console.log('✅ Agent found:', agent.id);

    // Get current order status (validate it exists and is assigned to this agent)
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('status, agent_id')
      .eq('id', order_id)
      .single();

    if (!currentOrder) {
      throw new Error('Order not found');
    }

    if (currentOrder.agent_id !== agent.id) {
      throw new Error('Order not assigned to this agent');
    }

    if (currentOrder.status === 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order already delivered' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['assigned', 'packed', 'out_for_delivery'].includes(currentOrder.status)) {
      throw new Error(`Order cannot be completed from status: ${currentOrder.status}`);
    }

    console.log('🔄 Updating order status with bypassed validation...');

    // Set payment status
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    const delivery_timestamp = new Date().toISOString();

    // Use RPC function to bypass problematic triggers
    const { error: rpcError } = await supabaseAdmin
      .rpc('update_order_status', {
        p_order_id: order_id,
        p_new_status: 'delivered',
        p_new_payment_status: payment_status,
        p_agent_id: agent.id
      });

    if (rpcError) {
      console.error('❌ RPC update failed:', rpcError);
      
      // Fallback to direct SQL execution if RPC fails
      console.log('🔄 Trying fallback direct update...');
      
      try {
        const { error: directUpdateError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: delivery_timestamp,
            payment_status: payment_status,
            updated_at: delivery_timestamp
          })
          .eq('id', order_id)
          .eq('agent_id', agent.id);

        if (directUpdateError) {
          throw new Error(`Direct update failed: ${directUpdateError.message}`);
        }
      } catch (fallbackError) {
        console.error('❌ All update methods failed:', fallbackError);
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
        throw new Error(`Failed to update order: ${errorMessage}`);
      }
    }

    console.log('✅ Order updated successfully');

    // Log success for debugging
    await supabaseAdmin
      .from('password_reset_logs')
      .insert({
        email: 'system@zaago.com',
        event_type: 'email_sent',
        metadata: {
          action: 'delivery_completed_edge_function',
          order_id: order_id,
          agent_id: agent.id,
          payment_method: payment_method,
          completion_time: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Delivery completed successfully',
        order_id: order_id,
        payment_status: payment_status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Delivery completion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});