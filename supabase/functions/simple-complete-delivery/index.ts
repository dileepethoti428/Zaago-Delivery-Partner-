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

    console.log('🔍 Step 1: Fetching order details');
    // Simplify order fetch - only get essential fields to avoid JSON parsing issues
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, agent_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('❌ Step 1 Failed - Order fetch error:', orderError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found',
          details: orderError?.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`✅ Step 1 Complete - Order found: { id: "${order.id}", status: "${order.status}" }`);

    console.log('🔍 Step 2: Validating order assignment');
    // Validate order belongs to this agent
    if (order.agent_id !== agent.id) {
      console.error('❌ Step 2 Failed - Order not assigned to this agent');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not assigned to this agent' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Step 2 Complete - Order is assigned to agent');

    console.log('🔍 Step 3: Checking order status');
    if (order.status === 'delivered') {
      console.log('⚠️ Step 3 - Order already delivered');
      return new Response(
        JSON.stringify({
          success: true,
          already_delivered: true,
          message: 'Order was already delivered',
          order: {
            id: order.id,
            status: order.status,
            agent_name: agent.name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['assigned', 'packed'].includes(order.status)) {
      console.error(`❌ Step 3 Failed - Invalid order status: ${order.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot complete delivery. Order status is: ${order.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Step 3 Complete - Order status is valid for completion');

    // Calculate safe values with defaults
    const safeDistance = Math.max(0, Number(distance_km) || 0) || 2.5;
    const safePayout = Math.max(0, Number(agent_payout) || 0) || 20;
    
    console.log(`💰 Using safe values: { safeDistance: ${safeDistance}, safePayout: ${safePayout} }`);
    
    console.log('🔍 Step 4: Checking existing earnings to prevent duplicates');
    try {
      // Check if earning already exists for this order (prevents duplicate earnings)
      const { data: existingEarning } = await supabaseClient
        .from('earnings')
        .select('id')
        .eq('agent_id', agent.id)
        .eq('order_id', order_id)
        .single();

      if (existingEarning) {
        console.log('⚠️ Step 4 - Earning already exists, skipping wallet/earning updates');
        return new Response(
          JSON.stringify({
            success: true,
            already_processed: true,
            message: 'Order delivery already processed',
            order: {
              id: order_id,
              status: 'delivered',
              agent_name: agent.name
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Step 4 Complete - No duplicate earning found');
    } catch (error) {
      // Single not found is expected, continue processing
      console.log('✅ Step 4 Complete - No existing earning (expected)');
    }
    
    console.log('🔍 Step 5: Updating order status to delivered');
    const now = new Date().toISOString();
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    try {
      const { error: orderUpdateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          payment_status: payment_status,
          updated_at: now
        })
        .eq('id', order_id)
        .eq('agent_id', agent.id);

      if (orderUpdateError) {
        console.error('❌ Step 5 Failed - Order update error:', orderUpdateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update order status',
            details: orderUpdateError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('✅ Step 5 Complete - Order status updated to delivered');
    } catch (error) {
      console.error('❌ Step 5 Exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Exception during order update',
          details: error instanceof Error ? error.message : String(error)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🔍 Step 6: Updating agent wallet balance');
    try {
      // Get current wallet balance first
      const { data: currentWallet } = await supabaseClient
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', agent.id)
        .single();

      const currentBalance = currentWallet?.balance || 0;
      const newBalance = Number(currentBalance) + Number(safePayout);

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
        console.error('❌ Step 6 Failed - Wallet update error:', walletError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update agent wallet',
            details: walletError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`✅ Step 6 Complete - Agent wallet updated (${currentBalance} + ${safePayout} = ${newBalance})`);
    } catch (error) {
      console.error('❌ Step 6 Exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Exception during wallet update',
          details: error instanceof Error ? error.message : String(error)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🔍 Step 7: Creating earning record');
    try {
      const { error: earningError } = await supabaseClient
        .from('earnings')
        .insert({
          agent_id: agent.id,
          order_id: order_id,
          amount: safePayout,
          status: 'completed',
          description: `Delivery completion: ${safeDistance}km`
        });

      if (earningError) {
        console.error('❌ Step 7 Failed - Earning creation error:', earningError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to create earning record',
            details: earningError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('✅ Step 7 Complete - Earning record created');
    } catch (error) {
      console.error('❌ Step 7 Exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Exception during earning creation',
          details: error instanceof Error ? error.message : String(error)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🔍 Step 8: Creating wallet transaction record');
    try {
      const { error: transactionError } = await supabaseClient
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agent.id,
          order_id: order_id,
          amount: safePayout,
          transaction_type: 'delivery_payment',
          description: 'Delivery completion payment'
        });

      if (transactionError) {
        console.error('❌ Step 8 Failed - Transaction creation error:', transactionError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to create transaction record',
            details: transactionError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('✅ Step 8 Complete - Transaction record created');
    } catch (error) {
      console.error('❌ Step 8 Exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Exception during transaction creation',
          details: error instanceof Error ? error.message : String(error)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🎉 All steps completed successfully!');

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