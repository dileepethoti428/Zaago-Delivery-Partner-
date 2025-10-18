import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { order_id, payment_method } = await req.json();
    console.log('📦 Complete delivery V2:', { order_id, payment_method });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user?.email) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get active agent by email
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, email, name, total_deliveries, total_earnings')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if already delivered
    const { data: existingDelivery } = await supabase
      .from('delivery_history')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle();

    if (existingDelivery) {
      console.log('⚠️ Order already delivered');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order already delivered',
          already_completed: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Normalize payment method - convert to uppercase first
    const upperPayment = (payment_method || 'COD').toUpperCase();
    const normalizedPayment = (upperPayment === 'ONLINE' || upperPayment === 'UPI' || upperPayment === 'CARD' || upperPayment === 'ONLINE PAYMENT') 
      ? 'ONLINE' 
      : 'COD';
    
    console.log('🔄 Payment normalization:', { 
      original: payment_method, 
      upper: upperPayment,
      normalized: normalizedPayment 
    });
    
    const paymentStatus = normalizedPayment === 'ONLINE' ? 'paid' : 'pending';

    // Calculate payout (₹12 base + ₹8 per km after 1km)
    const distance_km = order.distance_km || 2.5;
    const payout_amount = distance_km <= 1 ? 12 : 12 + (distance_km - 1) * 8;
    const rounded_payout = Math.round(payout_amount);

    console.log('💰 Calculated payout:', { distance_km, payout_amount: rounded_payout });

    // Enhanced logging before INSERT
    console.log('🔍 Pre-INSERT verification:', {
      payment_method: normalizedPayment,
      payment_status: paymentStatus,
      typeof_payment_method: typeof normalizedPayment,
      value_length: normalizedPayment?.length,
      char_codes: normalizedPayment?.split('').map(c => c.charCodeAt(0)),
      json_stringify: JSON.stringify({ payment_method: normalizedPayment }),
      order_id: order_id,
      agent_id: agent.id
    });

    // 1. Insert delivery history
    const { error: historyError } = await supabase
      .from('delivery_history')
      .insert({
        order_id: order_id,
        agent_id: agent.id,
        customer_name: order.delivery_address?.fullName || order.customer_name || 'Customer',
        customer_phone: order.delivery_address?.phone || order.customer_phone || '',
        delivery_address: order.delivery_address || order.address,
        items: order.items,
        total_amount: order.total,
        payment_method: normalizedPayment,
        payment_status: paymentStatus,
        delivery_payout: rounded_payout,
        delivery_date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
        distance_traveled: distance_km
      });

    if (historyError) {
      console.error('Failed to insert delivery history:', historyError);
      throw historyError;
    }

    // 2. Update orders table
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        payment_status: paymentStatus,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (orderUpdateError) {
      console.error('Failed to update order:', orderUpdateError);
      throw orderUpdateError;
    }

    // 3. Update delivery agent stats
    const { error: agentUpdateError } = await supabase
      .from('delivery_agents')
      .update({
        total_deliveries: (agent.total_deliveries || 0) + 1,
        deliveries_today: supabase.raw('deliveries_today + 1'),
        last_delivery_at: new Date().toISOString(),
        total_earnings: (agent.total_earnings || 0) + rounded_payout,
        updated_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    if (agentUpdateError) {
      console.error('Failed to update agent:', agentUpdateError);
      // Don't throw - this is not critical
    }

    // 4. Insert earnings record
    const { error: earningsError } = await supabase
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: rounded_payout,
        status: 'completed',
        description: `Delivery payout: ${distance_km.toFixed(2)}km`
      });

    if (earningsError) {
      console.error('Failed to insert earnings:', earningsError);
      // Don't throw - continue with wallet update
    }

    // 5. Update agent wallet
    const { data: existingWallet } = await supabase
      .from('agent_wallet')
      .select('balance')
      .eq('agent_id', agent.id)
      .maybeSingle();

    if (existingWallet) {
      // Update existing wallet
      const { error: walletUpdateError } = await supabase
        .from('agent_wallet')
        .update({
          balance: (existingWallet.balance || 0) + rounded_payout,
          updated_at: new Date().toISOString()
        })
        .eq('agent_id', agent.id);

      if (walletUpdateError) {
        console.error('Failed to update wallet:', walletUpdateError);
      }
    } else {
      // Create new wallet
      const { error: walletInsertError } = await supabase
        .from('agent_wallet')
        .insert({
          agent_id: agent.id,
          balance: rounded_payout,
          updated_at: new Date().toISOString()
        });

      if (walletInsertError) {
        console.error('Failed to create wallet:', walletInsertError);
      }
    }

    // 6. Insert wallet transaction
    const { error: transactionError } = await supabase
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order_id,
        amount: rounded_payout,
        transaction_type: 'delivery_payment',
        description: `Delivery payout: ${distance_km.toFixed(2)}km`,
        status: 'completed'
      });

    if (transactionError) {
      console.error('Failed to insert transaction:', transactionError);
      // Don't throw - not critical
    }

    console.log('✅ Delivery completed successfully (V2)');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Delivery completed successfully',
        payout_amount: rounded_payout,
        payment_method: normalizedPayment,
        payment_status: paymentStatus,
        distance_km: distance_km,
        order_id: order_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Complete delivery V2 error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to complete delivery',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
