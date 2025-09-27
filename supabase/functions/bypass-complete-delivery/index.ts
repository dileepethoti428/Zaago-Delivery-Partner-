import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔥 Bypass delivery completion started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online' } = body;
    
    console.log('📋 Processing order bypass:', { order_id, payment_method });
    
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

    // Step 1: Get order details first
    console.log('🔄 Getting order details...');
    const { data: order, error: orderFetchError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderFetchError || !order) {
      console.error('❌ Order fetch failed:', orderFetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found',
          details: orderFetchError?.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('✅ Order found:', { id: order.id, status: order.status });

    // Step 2: Update order status directly
    console.log('🔄 Updating order status...');
    const newPaymentStatus = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    const { error: orderUpdateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .eq('agent_id', agent.id);

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

    console.log('✅ Order status updated to delivered');

    // Step 3: Calculate payout (simple calculation)
    const basePayout = 25; // Base payout amount
    const distanceBonus = 0; // Can be enhanced later
    const totalPayout = basePayout + distanceBonus;

    // Step 4: Handle agent wallet update properly
    console.log('🔄 Updating agent wallet...');
    
    // First get current wallet balance
    const { data: currentWallet, error: walletFetchError } = await supabaseClient
      .from('agent_wallet')
      .select('balance')
      .eq('agent_id', agent.id)
      .single();

    const currentBalance = currentWallet?.balance || 0;
    const newBalance = currentBalance + totalPayout;

    const { error: walletError } = await supabaseClient
      .from('agent_wallet')
      .upsert({
        agent_id: agent.id,
        balance: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_id'
      });

    if (walletError) {
      console.error('❌ Wallet update failed:', walletError);
      // Continue anyway - don't fail the delivery for wallet issues
    } else {
      console.log('✅ Agent wallet updated, new balance:', newBalance);
    }

    // Step 5: Create earnings record
    console.log('🔄 Creating earnings record...');
    const { error: earningsError } = await supabaseClient
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: totalPayout,
        status: 'completed',
        description: `Delivery payout for order ${order_id}`,
        created_at: new Date().toISOString()
      });

    if (earningsError) {
      console.error('❌ Earnings creation failed:', earningsError);
      // Continue anyway - don't fail the delivery for earnings issues
    } else {
      console.log('✅ Earnings record created');
    }

    // Step 6: Create wallet transaction
    console.log('🔄 Creating wallet transaction...');
    const { error: transactionError } = await supabaseClient
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: totalPayout,
        transaction_type: 'delivery_payment',
        description: 'Delivery payout',
        status: 'completed',
        created_at: new Date().toISOString()
      });

    if (transactionError) {
      console.error('❌ Transaction creation failed:', transactionError);
      // Continue anyway - don't fail the delivery for transaction issues
    } else {
      console.log('✅ Wallet transaction created');
    }

    console.log('🎉 Product delivered successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Product delivered successfully! 🎉',
        order: {
          id: order_id,
          status: 'delivered',
          payment_method: payment_method,
          payout_amount: totalPayout,
          agent_name: agent.name,
          completed_at: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Bypass delivery completion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        technical_details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});