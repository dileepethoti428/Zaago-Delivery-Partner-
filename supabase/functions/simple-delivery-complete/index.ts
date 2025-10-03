import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Ultra-simple delivery completion starting...');
    
    const { order_id, payment_method } = await req.json();
    
    if (!order_id || !payment_method) {
      throw new Error('Missing required fields');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📋 Processing order:', order_id, 'Payment:', payment_method);

    // Get auth header for agent verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      throw new Error('Authentication failed');
    }

    console.log('✅ User authenticated:', user.email);

    // Find the agent
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent lookup failed:', agentError);
      throw new Error('Agent not found or inactive');
    }

    console.log('✅ Agent found:', agent.id);

    // Get current order to verify it can be completed
    const { data: currentOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, status, agent_id, total')
      .eq('id', order_id)
      .single();

    if (orderError || !currentOrder) {
      console.error('❌ Order lookup failed:', orderError);
      throw new Error('Order not found');
    }

    console.log('📦 Current order status:', currentOrder.status);

    // Check if already delivered
    if (currentOrder.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is assigned to this order
    if (currentOrder.agent_id !== agent.id) {
      throw new Error('Order not assigned to this agent');
    }

    // Check valid status for completion
    const validStatuses = ['assigned', 'packed', 'out_for_delivery'];
    if (!validStatuses.includes(currentOrder.status)) {
      throw new Error(`Cannot complete order from status: ${currentOrder.status}`);
    }

    console.log('🎯 Starting simple delivery completion...');

    // Step 1: Update order status - ULTRA SIMPLE
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('agent_id', agent.id);

    if (updateError) {
      console.error('❌ Order update failed:', updateError);
      throw new Error('Failed to update order status');
    }

    console.log('✅ Order status updated to delivered');

    // Step 2: Add simple earnings record - FIXED AMOUNT (like Blinkit)
    const fixedPayout = 40; // ₹40 base delivery fee
    
    const { error: earningsError } = await supabase
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: fixedPayout,
        distance_km: 2.5,
        status: 'completed',
        description: 'Simple delivery payout'
      });

    if (earningsError) {
      console.log('⚠️ Earnings insert failed (non-critical):', earningsError);
      // Don't throw - earnings can be processed later
    } else {
      console.log('✅ Earnings record created');
      
      // Update delivery_history with actual payout data
      const { error: historyUpdateError } = await supabase
        .from('delivery_history')
        .update({
          delivery_payout: fixedPayout,
          distance_traveled: 2.5,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', order_id);

      if (historyUpdateError) {
        console.log('⚠️ Delivery history update failed, continuing:', historyUpdateError);
      } else {
        console.log('✅ Delivery history updated with payout');
      }
    }

    // Step 3: Update agent wallet - SIMPLE UPSERT
    const { error: walletError } = await supabase
      .from('agent_wallet')
      .upsert({
        agent_id: agent.id,
        balance: fixedPayout,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_id',
        ignoreDuplicates: false
      })
      .select();

    if (walletError) {
      console.log('⚠️ Wallet update failed (non-critical):', walletError);
      // Don't throw - wallet can be updated later
    } else {
      console.log('✅ Wallet updated');
    }

    // Step 4: Add wallet transaction - SIMPLE INSERT
    const { error: transactionError } = await supabase
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: fixedPayout,
        transaction_type: 'delivery_payment',
        description: 'Simple delivery payout'
      });

    if (transactionError) {
      console.log('⚠️ Transaction insert failed (non-critical):', transactionError);
      // Don't throw - transaction can be added later
    } else {
      console.log('✅ Transaction recorded');
    }

    console.log('🎉 Simple delivery completion successful!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully',
        order_id: order_id,
        payment_method: payment_method,
        payout: fixedPayout
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Simple delivery completion error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});