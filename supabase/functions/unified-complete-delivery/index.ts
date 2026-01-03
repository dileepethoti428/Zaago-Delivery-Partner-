import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subscription orders have NO payout - count only
const SUBSCRIPTION_PAYOUT = 0;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, payment_method, order_type } = await req.json();

    // Determine if this is a daily/subscription order
    const isDailyOrder = order_type === 'daily';

    console.log('🚀 Unified delivery completion request:', { 
      order_id, 
      payment_method,
      order_type: order_type || 'regular',
      is_daily: isDailyOrder,
      timestamp: new Date().toISOString()
    });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Auth client (use ANON key) + pass JWT explicitly
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    // Service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent details - use maybeSingle() to avoid throwing on no match
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Agent authenticated:', agent.name);

    // Normalize payment method to match RPC enum: 'cod' | 'razorpay' | 'upi' | 'subscription_auto'
    let normalizedPayment = 'cod';
    if (payment_method) {
      const pm = payment_method.toLowerCase();
      if (pm === 'online' || pm === 'razorpay') {
        normalizedPayment = 'razorpay';
      } else if (pm === 'upi') {
        normalizedPayment = 'upi';
      } else if (pm === 'subscription_auto') {
        normalizedPayment = 'subscription_auto';
      } else {
        normalizedPayment = 'cod';
      }
    }
    console.log('💳 Payment method normalized:', { original: payment_method, normalized: normalizedPayment });

    let result: any = null;

    // Handle daily/subscription orders differently - NO PAYOUT
    if (isDailyOrder) {
      console.log('📦 Processing daily/subscription order completion (NO PAYOUT)...');
      
      try {
        // Step 1: Fetch daily order with basic relationships
        const { data: dailyOrder, error: dailyError } = await supabase
          .from('daily_orders')
          .select(`
            id,
            status,
            customer_id,
            subscription_id,
            quantity,
            date,
            customers(full_name, phone, address, city, state, pincode),
            subscriptions(product_id, delivery_address)
          `)
          .eq('id', order_id)
          .single();

        if (dailyError || !dailyOrder) {
          console.error('❌ Daily order not found:', dailyError);
          return new Response(
            JSON.stringify({ success: false, error: 'Daily order not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('📋 Daily order found:', dailyOrder.id, 'status:', dailyOrder.status);

        // Step 2: Fetch product details separately
        const subscription = dailyOrder.subscriptions as any;
        let product: any = null;

        if (subscription?.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('id, name, price, seller_id')
            .eq('id', subscription.product_id)
            .single();
          
          product = productData;
          console.log('📦 Product found:', product?.name);
        }

        const customer = dailyOrder.customers as any;
        const totalAmount = (product?.price || 0) * dailyOrder.quantity;

        // Check if already delivered
        if (dailyOrder.status === 'delivered') {
          console.log('⚠️ Daily order already delivered');
          result = { success: true, already_completed: true, payout_amount: SUBSCRIPTION_PAYOUT };
        } else {
          // Update daily_orders status to delivered
          const { error: updateError } = await supabase
            .from('daily_orders')
            .update({ status: 'delivered' })
            .eq('id', order_id);

          if (updateError) {
            console.error('❌ Failed to update daily order:', updateError);
            throw new Error('Failed to update daily order status');
          }

          console.log('✅ Daily order status updated to delivered');

          // Insert into delivery_history - NO PAYOUT for subscription
          const { error: historyError } = await supabase
            .from('delivery_history')
            .insert({
              order_id: order_id,
              agent_id: agent.id,
              customer_name: customer?.full_name || 'Customer',
              customer_phone: customer?.phone,
              delivery_address: {
                address: customer?.address || (dailyOrder.subscriptions as any)?.delivery_address,
                city: customer?.city,
                state: customer?.state,
                pincode: customer?.pincode
              },
              items: [{
                name: product?.name || 'Subscription Product',
                quantity: dailyOrder.quantity,
                price: product?.price || 0
              }],
              total_amount: totalAmount,
              payment_method: normalizedPayment,
              payment_status: normalizedPayment === 'razorpay' || normalizedPayment === 'upi' ? 'paid' : 'collected',
              delivery_date: dailyOrder.date,
              completed_at: new Date().toISOString(),
              delivery_payout: SUBSCRIPTION_PAYOUT
            });

          if (historyError) {
            console.warn('⚠️ Failed to insert delivery history:', historyError);
          }

          // Insert into agent_earnings_tracking for subscription orders
          const { error: trackingError } = await supabase
            .from('agent_earnings_tracking')
            .insert({
              order_id: order_id,
              agent_id: agent.id,
              accepted_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              expected_payout: 0,
              actual_payout: 0,
              distance_km: 0,
              is_peak_hour: false,
              payout_status: 'confirmed',
              payout_breakdown: { subscription: true, base_pay: 0, distance_pay: 0 },
              order_type: 'subscription'
            });

          if (trackingError) {
            console.warn('⚠️ Failed to insert subscription earnings tracking:', trackingError);
          } else {
            console.log('✅ Subscription earnings tracking inserted');
          }

          console.log('✅ Daily order completed successfully (no payout for subscription)');
          result = { success: true, payout_amount: SUBSCRIPTION_PAYOUT };
        }
      } catch (dailyErr) {
        console.error('❌ Daily order completion failed:', dailyErr);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: dailyErr instanceof Error ? dailyErr.message : 'Daily order completion failed'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Regular order flow - delegate 100% to DB via complete_delivery_zepto
      console.log('📦 Processing regular order completion via Zepto RPC...');

      const { data, error } = await supabase.rpc(
        'complete_delivery_zepto',
        {
          p_order_id: order_id,
          p_agent_id: agent.id,
          p_payment_method: normalizedPayment
        }
      );

      if (error) {
        console.error('❌ complete_delivery_zepto failed:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message || 'Delivery completion failed'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!data?.success) {
        console.error('❌ complete_delivery_zepto returned failure:', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: data?.error || 'Delivery completion failed'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Zepto completion successful:', data);
      result = {
        success: true,
        payout_amount: data.payout_amount,
        distance_km: data.distance_km,
        payout_breakdown: data.payout_breakdown,
        already_completed: data.already_completed || false
      };
    }

    // Return success
    const finalPayout = isDailyOrder ? SUBSCRIPTION_PAYOUT : (result.payout_amount || 0);
    
    console.log('🎉 Delivery completed successfully via unified flow', {
      order_id,
      order_type: isDailyOrder ? 'subscription' : 'regular',
      payment_method: normalizedPayment,
      already_completed: result.already_completed || false,
      payout_amount: finalPayout,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: result.already_completed ? 'Order already completed' : 'Delivery completed successfully',
        order_id,
        order_type: isDailyOrder ? 'subscription' : 'regular',
        payout_amount: finalPayout,
        payout_breakdown: isDailyOrder ? null : result.payout_breakdown,
        distance_km: result.distance_km || 0,
        already_completed: result.already_completed || false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
