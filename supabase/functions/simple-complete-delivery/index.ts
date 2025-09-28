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
    // Parse request body
    const body = await req.json();
    const { order_id, payment_method = 'Online', distance_km = 2.5, agent_payout = 20 } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, distance_km, agent_payout });
    
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

    // Get authenticated user
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
        JSON.stringify({ success: false, error: 'Authentication failed' }),
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
      console.error('❌ Agent lookup failed:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // First, fetch the order to validate it exists and is assigned to this agent
    const { data: order, error: fetchError } = await supabaseClient
      .from('orders')
      .select('id, status, agent_id, customer_name, total')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      console.error('❌ Order fetch failed:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Validate order is assigned to this agent
    if (order.agent_id !== agent.id) {
      console.error('❌ Order not assigned to this agent:', { orderAgentId: order.agent_id, currentAgentId: agent.id });
      return new Response(
        JSON.stringify({ success: false, error: 'Order not assigned to this agent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Check if order is already delivered
    if (order.status === 'delivered') {
      console.log('ℹ️ Order already delivered');
      return new Response(
        JSON.stringify({
          success: true,
          already_delivered: true,
          message: 'Order was already delivered',
          order: {
            id: order_id,
            status: 'delivered',
            agent_name: agent.name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate order status is valid for completion
    if (!['assigned', 'packed'].includes(order.status)) {
      console.error('❌ Invalid order status for completion:', order.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot complete order with status: ${order.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Order validation passed:', { id: order.id, status: order.status });

    // Validate distance and payout with safe defaults
    const safeDistance = Math.max(Number(distance_km) || 2.5, 0.1);
    const safePayout = Math.max(Number(agent_payout) || (safeDistance <= 1 ? 12 : 12 + (safeDistance - 1) * 8), 12);
    
    console.log('💰 Using safe values:', { safeDistance, safePayout });

    // Direct database update using service role to bypass RPC issues
    const now = new Date().toISOString();
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    // Use more specific update to avoid JSON parsing issues
    const { data: updateResult, error: orderUpdateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        payment_status: payment_status,
        updated_at: now
      })
      .eq('id', order_id)
      .in('status', ['assigned', 'packed']) // Allow packed or assigned orders
      .select('id, status, customer_name, total');

    if (orderUpdateError) {
      console.error('❌ Order update failed:', orderUpdateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update order status',
          details: orderUpdateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!updateResult || updateResult.length === 0) {
      console.log('⚠️ No rows updated - order may already be delivered or not exist');
      
      // Check current order status
      const { data: currentOrder } = await supabaseClient
        .from('orders')
        .select('status')
        .eq('id', order_id)
        .single();
      
      if (currentOrder?.status === 'delivered') {
        return new Response(
          JSON.stringify({
            success: true,
            already_delivered: true,
            message: 'Order was already delivered',
            order: {
              id: order_id,
              status: 'delivered',
              agent_name: agent.name
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unable to update order. Order may not exist or already be processed.',
          details: `Current order status: ${currentOrder?.status || 'unknown'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Order marked as delivered');

    // Update agent wallet
    const { data: currentWallet } = await supabaseClient
      .from('agent_wallet')
      .select('balance')
      .eq('agent_id', agent.id)
      .single();

    const currentBalance = Number(currentWallet?.balance || 0);
    const newBalance = currentBalance + safePayout;

    const { error: walletError } = await supabaseClient
      .from('agent_wallet')
      .upsert({
        agent_id: agent.id,
        balance: newBalance,
        updated_at: now
      }, {
        onConflict: 'agent_id'
      });

    if (walletError) {
      console.log('⚠️ Wallet update warning:', walletError);
    } else {
      console.log('✅ Agent wallet updated');
    }

    // Create earnings record
    const { error: earningsError } = await supabaseClient
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: safePayout,
        status: 'completed',
        description: `Delivery payout: ${safeDistance}km`
      });

    if (earningsError) {
      console.log('⚠️ Earnings record warning:', earningsError);
    } else {
      console.log('✅ Earnings record created');
    }

    // Create wallet transaction
    const { error: transactionError } = await supabaseClient
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: safePayout,
        transaction_type: 'delivery_payment',
        description: 'Delivery completion payout',
        status: 'completed'
      });

    if (transactionError) {
      console.log('⚠️ Transaction record warning:', transactionError);
    } else {
      console.log('✅ Wallet transaction recorded');
    }

    console.log('✅ Delivery completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order completed successfully',
        order: {
          id: order_id,
          status: 'delivered',
          payment_method,
          distance_km: safeDistance,
          payout_amount: safePayout,
          agent_name: agent.name,
          completed_at: now
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Simple complete delivery error:', error);
    
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