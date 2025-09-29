import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, payment_method } = await req.json();

    if (!order_id || !payment_method) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or payment_method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user token for auth context
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user?.email) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('agent_id', agent.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found or not assigned to agent' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already delivered
    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ error: 'Order already delivered' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate payout (simple calculation)
    const basePayout = 25; // Base delivery fee
    const distanceBonus = 0; // Can be enhanced later
    const totalPayout = basePayout + distanceBonus;

    // Start transaction
    const now = new Date().toISOString();
    const paymentStatus = payment_method === 'COD' ? 'paid_cod' : 'paid_online';

    // Update order status to delivered
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        payment_status: paymentStatus,
        updated_at: now
      })
      .eq('id', order_id);

    if (updateOrderError) {
      throw new Error(`Failed to update order: ${updateOrderError.message}`);
    }

    // Create earnings record
    const { error: earningsError } = await supabase
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: totalPayout,
        status: 'completed',
        description: `Delivery payout - ${payment_method}`
      });

    if (earningsError && !earningsError.message.includes('duplicate')) {
      console.error('Earnings creation error:', earningsError);
    }

    // Update agent wallet
    const { error: walletError } = await supabase
      .from('agent_wallet')
      .upsert({
        agent_id: agent.id,
        balance: (agent.wallet_balance || 0) + totalPayout,
        updated_at: now
      }, {
        onConflict: 'agent_id'
      });

    if (walletError) {
      console.error('Wallet update error:', walletError);
    }

    // Create wallet transaction
    const { error: transactionError } = await supabase
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: totalPayout,
        transaction_type: 'delivery_payment',
        description: `Delivery completed - ${payment_method}`
      });

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
    }

    // Log completion for audit
    console.log(`✅ Order ${order_id} completed by agent ${agent.id} (${agent.email})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully',
        order_id: order_id,
        payout_amount: totalPayout,
        payment_method: payment_method
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Complete delivery error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});