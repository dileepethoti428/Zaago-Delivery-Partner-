import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Zepto/Blinkit style pricing for regular orders
const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
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
    const { order_id, payment_method, live_distance_km } = await req.json();
    console.log('📦 Complete delivery V2:', { order_id, payment_method, live_distance_km });

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

    // Check if already delivered by this agent (idempotency)
    const { data: existingDelivery } = await supabase
      .from('delivery_history')
      .select('id, completed_at')
      .eq('order_id', order_id)
      .eq('agent_id', agent.id)
      .maybeSingle();

    if (existingDelivery) {
      console.log('⚠️ Order already delivered by this agent at:', existingDelivery.completed_at);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order already delivered',
          already_completed: true,
          completed_at: existingDelivery.completed_at
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

    // Use live distance if provided, otherwise fallback to order distance
    const distance_km = live_distance_km || order.distance_km || 2.5;

    console.log('📍 Distance calculation:', {
      live_distance_km,
      order_distance_km: order.distance_km,
      final_distance_km: distance_km,
      source: live_distance_km ? 'live' : (order.distance_km ? 'order' : 'fallback')
    });

    // Calculate payout using Zepto/Blinkit formula
    // ₹10 base + ₹8/km - Distance rounded UP (ceil) for fair agent pay
    const roundedDistance = Math.ceil(distance_km * 10) / 10;
    const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
    const totalPayout = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
    const rounded_payout = Math.round(totalPayout * 10) / 10;

    console.log('💰 Calculated payout (Zepto/Blinkit style):', { 
      distance_km: roundedDistance, 
      base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
      distance_pay: Math.round(distancePay * 10) / 10,
      total_payout: rounded_payout,
      calculation: `₹${REGULAR_ORDER_PRICING.BASE_PAY} base + (${roundedDistance}km × ₹${REGULAR_ORDER_PRICING.DISTANCE_RATE}) = ₹${rounded_payout}`
    });

    // Payout breakdown for transparency
    const payoutBreakdown = {
      base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
      distance_pay: Math.round(distancePay * 10) / 10,
      distance_km: roundedDistance,
      rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE
    };

    // Enhanced logging before INSERT
    console.log('🔍 Pre-INSERT verification:', {
      payment_method: normalizedPayment,
      payment_status: paymentStatus,
      payout_breakdown: payoutBreakdown,
      order_id: order_id,
      agent_id: agent.id
    });

    // 1. Insert delivery history with duplicate handling
    try {
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
          distance_traveled: roundedDistance
        });

      if (historyError) {
        // Handle duplicate key error (race condition)
        if (historyError.code === '23505') {
          console.log('⚠️ Duplicate delivery_history detected, ensuring order is marked delivered');
          
          // Even if delivery_history exists, make sure order status is updated
          const { error: orderStatusUpdateError } = await supabase
            .from('orders')
            .update({
              status: 'delivered',
              payment_status: paymentStatus,
              delivered_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', order_id)
            .neq('status', 'delivered'); // Only update if not already delivered
          
          if (orderStatusUpdateError) {
            console.error('Failed to update order status on duplicate:', orderStatusUpdateError);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Order already delivered',
              already_completed: true,
              status_updated: !orderStatusUpdateError
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw historyError;
      }
    } catch (error) {
      console.error('Failed to insert delivery history:', error);
      throw error;
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
        description: `Delivery: ₹${REGULAR_ORDER_PRICING.BASE_PAY} base + ${roundedDistance}km × ₹${REGULAR_ORDER_PRICING.DISTANCE_RATE}`,
        distance_km: roundedDistance
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
        description: `Delivery: ₹${REGULAR_ORDER_PRICING.BASE_PAY} base + ${roundedDistance}km × ₹${REGULAR_ORDER_PRICING.DISTANCE_RATE}`,
        status: 'completed'
      });

    if (transactionError) {
      console.error('Failed to insert transaction:', transactionError);
      // Don't throw - not critical
    }

    // 7. Update earnings tracking with final payout breakdown
    const { error: trackingUpdateError } = await supabase
      .from('agent_earnings_tracking')
      .update({
        completed_at: new Date().toISOString(),
        actual_payout: rounded_payout,
        payout_status: 'confirmed',
        distance_km: roundedDistance,
        payment_method: normalizedPayment,
        is_peak_hour: false, // No peak hour in new model
        payout_breakdown: payoutBreakdown,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order_id)
      .eq('agent_id', agent.id);

    if (trackingUpdateError) {
      console.error('❌ CRITICAL: Failed to update earnings tracking:', trackingUpdateError);
      // This is critical - throw error instead of just logging
      throw new Error('Failed to update earnings tracking: ' + trackingUpdateError.message);
    } else {
      console.log('✅ Earnings tracking updated to confirmed', {
        order_id,
        agent_id: agent.id,
        actual_payout: rounded_payout,
        distance_km: roundedDistance,
        payout_status: 'confirmed',
        breakdown: payoutBreakdown
      });
    }

    console.log('✅ Delivery completed successfully (V2 - Zepto/Blinkit pricing)');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Delivery completed successfully',
        payout_amount: rounded_payout,
        payout_breakdown: payoutBreakdown,
        payment_method: normalizedPayment,
        payment_status: paymentStatus,
        distance_km: roundedDistance,
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