import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, payment_method, qr_code_data, payment_id, order_type } = await req.json();

    // Determine if this is a daily/subscription order
    const isDailyOrder = order_type === 'daily';

    console.log('🚀 Unified delivery completion request:', { 
      order_id, 
      payment_method,
      order_type: order_type || 'regular',
      is_daily: isDailyOrder,
      has_qr: !!qr_code_data,
      payment_id: payment_id || 'none',
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

    // Auth client (use ANON key) + pass JWT explicitly (Edge Functions have no persisted session)
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

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Agent authenticated:', agent.name);

    // Normalize payment method
    const normalizedPayment = payment_method?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'COD';

    let result: any = null;

    // Handle daily/subscription orders differently
    if (isDailyOrder) {
      console.log('📦 Processing daily/subscription order completion...');
      
      try {
        // Fetch daily order details
        const { data: dailyOrder, error: dailyError } = await supabase
          .from('daily_orders')
          .select(`
            id,
            status,
            customer_id,
            subscription_id,
            quantity,
            date,
            customers!inner(full_name, phone, address, city, state, pincode),
            subscriptions!inner(product_id, delivery_address, products_with_sellers(name, price, seller_id, sellers(business_name, address, phone)))
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

        // Check if already delivered
        if (dailyOrder.status === 'delivered') {
          console.log('⚠️ Daily order already delivered');
          result = { success: true, already_completed: true, payout_amount: 30 };
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

          // Get product details for history
          const product = (dailyOrder.subscriptions as any)?.products_with_sellers;
          const customer = dailyOrder.customers as any;
          const seller = product?.sellers;
          const totalAmount = (product?.price || 0) * dailyOrder.quantity;

          // Insert into delivery_history
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
              payment_status: normalizedPayment === 'ONLINE' ? 'paid' : 'collected',
              delivery_date: dailyOrder.date,
              completed_at: new Date().toISOString(),
              delivery_payout: 30
            });

          if (historyError) {
            console.warn('⚠️ Failed to insert delivery history:', historyError);
            // Don't fail the whole operation for history insert failure
          }

          // Update agent wallet with delivery payout
          const payoutAmount = 30;
          const { error: walletError } = await supabase.rpc('add_agent_earnings', {
            p_agent_id: agent.id,
            p_order_id: order_id,
            p_amount: payoutAmount,
            p_payment_method: normalizedPayment
          });

          if (walletError) {
            console.warn('⚠️ Failed to add earnings (trying direct insert):', walletError);
            // Try direct insert as fallback
            await supabase.from('earnings').insert({
              agent_id: agent.id,
              order_id: order_id,
              amount: payoutAmount,
              payment_method: normalizedPayment,
              status: 'completed'
            });
          }

          console.log('✅ Daily order completed successfully');
          result = { success: true, payout_amount: payoutAmount };
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
      // Regular order flow - existing logic
      
      // Method 1: Try QR completion if QR code data provided
      if (qr_code_data) {
        console.log('📱 Attempting QR completion...');
        try {
          const { data: qrResult, error: qrError } = await supabase.rpc(
            'qr_complete_delivery_v3',
            {
              p_qr_code_data: qr_code_data,
              p_agent_id: agent.id,
              p_payment_method: normalizedPayment
            }
          );

          if (!qrError && qrResult?.success) {
            console.log('✅ QR completion successful');
            result = qrResult;
          } else {
            console.log('⚠️ QR completion failed, trying manual method');
            console.log('QR Error:', qrError);
            console.log('QR Result:', qrResult);
          }
        } catch (qrErr) {
          console.log('⚠️ QR completion exception, trying manual method:', qrErr);
        }
      }

      // Method 2: Try manual completion if QR failed or not provided
      if (!result) {
        console.log('📝 Attempting manual completion...');
        try {
          const { data: manualResult, error: manualError } = await supabase.rpc(
            'manual_complete_delivery',
            {
              p_order_id: order_id,
              p_agent_id: agent.id,
              p_payment_method: normalizedPayment
            }
          );

          if (!manualError && manualResult?.success) {
            console.log('✅ Manual completion successful');
            result = manualResult;
          } else {
            console.log('⚠️ Manual completion failed, trying simple method');
            console.log('Manual Error:', manualError?.message || manualError);
            console.log('Manual Result:', manualResult);
          }
        } catch (manualErr) {
          console.log('⚠️ Manual completion exception, trying simple method:', manualErr);
        }
      }

      // Method 3: Simple fallback as last resort
      if (!result) {
        console.log('🆘 Attempting simple fallback completion...');
        try {
          const { data: simpleResult, error: simpleError } = await supabase.rpc(
            'simple_mark_delivered',
            {
              p_order_id: order_id,
              p_agent_id: agent.id,
              p_payment_method: normalizedPayment
            }
          );

          if (!simpleError && simpleResult?.success) {
            console.log('✅ Simple completion successful');
            result = simpleResult;
          } else {
            console.error('❌ All completion methods failed');
            console.error('Simple Error:', simpleError?.message || simpleError);
            console.error('Simple Result:', simpleResult);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: simpleError?.message || 'All delivery completion methods failed',
                details: simpleError
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (simpleErr) {
          console.error('❌ Simple completion exception:', simpleErr);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'All delivery completion methods failed',
              details: simpleErr
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Return success (including already completed cases)
    console.log('🎉 Delivery completed successfully via unified flow', {
      order_id,
      method_used: qr_code_data ? 'qr_scan' : 'manual',
      payment_method: normalizedPayment,
      already_completed: result.already_completed || false,
      payout_amount: result.payout_amount || 30,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: result.already_completed ? 'Order already completed' : 'Delivery completed successfully',
        order_id,
        method_used: qr_code_data ? 'qr_scan' : 'manual',
        payout_amount: result.payout_amount || 30,
        already_completed: result.already_completed || false,
        ...result
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