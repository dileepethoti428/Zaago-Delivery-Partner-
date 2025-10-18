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
    const { qr_code_data, payment_method } = await req.json();

    if (!qr_code_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR code data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // User client for authentication only
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent using admin client
    const { data: agents } = await supabaseAdmin
      .from('delivery_agents')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .limit(1);

    if (!agents || agents.length === 0) {
      console.error('❌ Agent not found for email:', user.email);
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agent = agents[0];
    console.log('✅ Agent found:', agent.id);

    // Get order from QR code using admin client
    const { data: qrData } = await supabaseAdmin
      .from('order_qr_codes')
      .select('order_id, is_scanned')
      .eq('qr_code_data', qr_code_data)
      .single();

    if (!qrData) {
      console.error('❌ Invalid QR code');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = qrData.order_id;
    console.log('✅ Order ID from QR:', orderId);

    // Get order details using admin client
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      console.error('❌ Order not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.status === 'delivered') {
      console.log('⚠️ Order already delivered');
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered', order_id: orderId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Order found:', order.id, 'Status:', order.status);

    // Normalize payment method
    const normalizedPayment = payment_method?.toUpperCase() === 'COD' ? 'COD' : 'ONLINE';
    const paymentStatus = normalizedPayment === 'ONLINE' ? 'paid' : 'pending';
    const currentTime = new Date().toISOString();

    console.log('💰 Payment:', normalizedPayment, 'Status:', paymentStatus);

    // 1. Insert delivery history using safe database function with explicit column mapping
    console.log('📝 Creating delivery history via database function');
    
    const { data: deliveryHistoryId, error: historyError } = await supabaseAdmin
      .rpc('insert_delivery_history_safe', {
        p_order_id: orderId,
        p_agent_id: agent.id,
        p_customer_name: order.customer_name || 'Customer',
        p_customer_phone: order.customer_phone,
        p_delivery_address: order.address,
        p_items: order.items,
        p_total_amount: order.total,
        p_delivery_date: new Date().toISOString().split('T')[0],
        p_payment_method: normalizedPayment,
        p_payment_status: paymentStatus,
        p_delivery_payout: 25.00,
        p_delivery_time_slot: null
      });

    if (historyError) {
      console.error('❌ History insert failed:', historyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record delivery: ' + historyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Delivery history created with ID:', deliveryHistoryId);

    // 2. Update order status using admin client
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: currentTime,
        payment_status: paymentStatus,
        updated_at: currentTime
      })
      .eq('id', orderId);

    if (orderError) {
      console.error('❌ Order update failed:', orderError);
    }

    // 3. Update agent stats using admin client
    const { error: agentError } = await supabaseAdmin
      .from('delivery_agents')
      .update({
        total_deliveries: agent.total_deliveries + 1,
        deliveries_today: agent.deliveries_today + 1,
        last_delivery_at: currentTime,
        total_earnings: agent.total_earnings + 25.00,
        updated_at: currentTime
      })
      .eq('id', agent.id);

    if (agentError) {
      console.error('❌ Agent update failed:', agentError);
    }

    // 4. Update agent wallet using admin client
    const { data: wallet } = await supabaseAdmin
      .from('agent_wallet')
      .select('balance')
      .eq('agent_id', agent.id)
      .single();

    if (wallet) {
      await supabaseAdmin
        .from('agent_wallet')
        .update({
          balance: wallet.balance + 25.00,
          updated_at: currentTime
        })
        .eq('agent_id', agent.id);
    } else {
      await supabaseAdmin
        .from('agent_wallet')
        .insert({
          agent_id: agent.id,
          balance: 25.00,
          updated_at: currentTime,
          created_at: currentTime
        });
    }

    console.log('✅ Wallet updated');

    // 5. Create wallet transaction using admin client
    const { error: txError } = await supabaseAdmin
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: orderId,
        amount: 25.00,
        transaction_type: 'delivery_payment',
        description: 'Delivery payout',
        status: 'completed',
        created_at: currentTime,
        updated_at: currentTime
      });

    if (txError) {
      console.error('❌ Transaction insert failed:', txError);
    }

    // 6. Mark QR as scanned using admin client
    await supabaseAdmin
      .from('order_qr_codes')
      .update({ is_scanned: true, scanned_at: currentTime })
      .eq('qr_code_data', qr_code_data);

    console.log('✅ QR marked as scanned');

    // Return success
    console.log('🎉 Delivery completed successfully!');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully',
        order_id: orderId,
        payment_method: normalizedPayment,
        payout_amount: 25.00
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
