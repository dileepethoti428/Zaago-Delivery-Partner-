import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Simple complete delivery request started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online' } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method });
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Simple authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', userData.user.email);

    // Get agent info
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Get the order first to check it exists and belongs to this agent
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, customer_name, total, agent_id')
      .eq('id', order_id)
      .eq('agent_id', agent.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or not assigned to this agent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Order found:', { id: order.id, status: order.status, customer: order.customer_name });

    // MINIMAL UPDATE - just the essential fields to avoid trigger issues
    const payment_status = payment_method.toUpperCase() === 'COD' ? 'paid_cod' : 'paid_online';
    const now = new Date().toISOString();
    
    console.log('💾 Performing minimal update...');
    
    // Try the simplest possible update with minimal fields
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({ 
        status: 'delivered',
        delivered_at: now,
        payment_status: payment_status
      })
      .eq('id', order_id)
      .eq('agent_id', agent.id);
        
    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update order status',
          details: updateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Order updated successfully');

    // Create simple earnings record (optional - don't fail if this fails)
    try {
      await supabaseClient
        .from('earnings')
        .insert({
          agent_id: agent.id,
          order_id: order_id,
          amount: 35, // Default payout
          status: 'completed',
          distance_km: 2.5,
          payment_method: payment_method === 'COD' ? 'COD' : 'Online',
          description: `Simple delivery completion for order ${order_id.substring(0, 8)}`
        });
      console.log('✅ Earnings record created');
    } catch (earningsError) {
      console.warn('⚠️ Earnings creation failed (continuing anyway):', earningsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          status: 'delivered'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Simple Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});