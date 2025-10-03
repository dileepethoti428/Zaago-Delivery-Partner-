import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Enhanced request body parsing with better error handling
    let body;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      console.log('📥 QR delivery request body:', rawBody);
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(rawBody);
      console.log('✅ Parsed request body:', body);
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format. Please ensure request body is valid JSON.',
          details: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let { qr_code_data, payment_method = 'Online' } = body;
    
    // Enhanced payment method validation and sanitization
    if (!payment_method || typeof payment_method !== 'string') {
      console.log('⚠️ Invalid payment_method received, defaulting to Online:', payment_method);
      payment_method = 'Online';
    } else {
      payment_method = payment_method.toString().trim();
    }
    
    console.log('📋 QR delivery request validated:', { qr_code_data, payment_method });

    if (!qr_code_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR code data is required' }),
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

    console.log('✅ Active agent found:', { id: agent.id, name: agent.name });

    // Validate QR code and get order details with agent assignment
    const { data: qrData, error: qrError } = await supabaseClient
      .from('order_qr_codes')
      .select(`
        order_id,
        is_scanned,
        orders (
          id,
          customer_name,
          customer_phone,
          address,
          items,
          total,
          status,
          payment_status,
          special_instructions,
          delivery_time_slot,
          agent_id
        )
      `)
      .eq('qr_code_data', qr_code_data)
      .single();

    if (qrError || !qrData) {
      console.error('❌ QR code validation failed:', qrError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const order = qrData.orders as any;

    // If order already delivered, return success (idempotent)
    if (order && order.status === 'delivered') {
      console.log('✅ Order already delivered, returning success');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '🎉 Product already delivered successfully!',
          already_delivered: true,
          order: {
            id: order.id,
            customer_name: order.customer_name,
            total: order.total,
            payment_status: order.payment_status,
            delivered_at: order.delivered_at
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhanced QR validation - Allow completion if order is ready
    if (qrData.is_scanned) {
      console.log('⚠️ QR already scanned, but proceeding if order is still deliverable...');
      
      // Only block if order is already delivered
      if (order && order.status === 'delivered') {
        console.log('✅ Order already delivered, blocking duplicate completion');
        return new Response(
          JSON.stringify({ success: false, error: 'Order already completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('🔄 QR scanned but order not delivered, proceeding with completion...');
    }

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found for this QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (order.status !== 'assigned') {
      if (order.status === 'delivered') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: '🎉 Product already delivered successfully!',
            already_delivered: true,
            order: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              payment_status: order.payment_status,
              delivered_at: order.delivered_at
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Order is not ready for delivery. Current status: ${order.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if order is assigned to this agent
    if (order.agent_id !== agent.id) {
      console.log(`❌ Order assignment mismatch. Order agent: ${order.agent_id}, Current agent: ${agent.id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '🚫 This order is not assigned to you. Only the assigned delivery agent can complete this delivery.',
          order_agent_id: order.agent_id,
          your_agent_id: agent.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Order validation passed, proceeding with QR delivery completion');

    // Mark QR as scanned
    const { error: scanUpdateError } = await supabaseClient
      .from('order_qr_codes')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        scanned_by: agent.id
      })
      .eq('qr_code_data', qr_code_data);

    if (scanUpdateError) {
      console.error('❌ Failed to mark QR as scanned:', scanUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ QR code marked as scanned');

    // Check if earnings already exist (idempotency check) - BEFORE updating order
    const { data: existingEarnings } = await supabaseClient
      .from('earnings')
      .select('id, amount, status')
      .eq('agent_id', agent.id)
      .eq('order_id', order.id)
      .maybeSingle();

    const distance_km = 2.5; // Default distance for QR deliveries
    const payout_amount = distance_km <= 1 ? 12 : 12 + (distance_km - 1) * 8; // New rates: ₹12 base + ₹8/km
    const now = new Date().toISOString();
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';

    console.log('📊 QR Delivery Context:', {
      qr_code_data: qr_code_data.substring(0, 20) + '...',
      order_id: order.id,
      agent_id: agent.id,
      agent_name: agent.name,
      customer_name: order.customer_name,
      order_total: order.total,
      payment_method: payment_method,
      order_status: order.status,
      payout_amount: payout_amount,
      existing_earnings: existingEarnings ? 'YES' : 'NO'
    });

    if (existingEarnings) {
      console.log('✅ Earnings already exist - updating order status only:', {
        earning_id: existingEarnings.id,
        amount: existingEarnings.amount,
        status: existingEarnings.status
      });
      
      // Only update order status since earnings already processed
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: now,
          payment_status: payment_status,
          updated_at: now
        })
        .eq('id', order.id)
        .eq('agent_id', agent.id);

      if (updateError) {
        console.error('❌ Failed to update order (earnings exist):', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update order status',
            details: updateError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('✅ Order updated successfully (partial completion recovery)');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product delivered successfully! 🎉 (Recovered)',
          order: {
            id: order.id,
            customer_name: order.customer_name,
            total: order.total,
            payment_method,
            agent_name: agent.name,
            completed_at: now,
            payout_amount: existingEarnings.amount,
            recovery_mode: true
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normal flow: Update order status first
    console.log('🔄 Updating order status (normal flow)...');
    
    // Use more specific update to avoid JSON parsing issues
    const { data: updateResult, error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        payment_status: payment_status,
        updated_at: now
      })
      .eq('id', order.id)
      .in('status', ['assigned', 'packed']) // Allow packed or assigned orders
      .select('id, status, customer_name, total');

    if (updateError) {
      console.error('❌ Order update failed:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update order status',
          details: updateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!updateResult || updateResult.length === 0) {
      console.log('⚠️ No rows updated - checking current order status...');
      
      // Check if order is already delivered
      const { data: currentOrder } = await supabaseClient
        .from('orders')
        .select('status, delivered_at, payment_status, customer_name, total')
        .eq('id', order.id)
        .single();
        
      if (currentOrder?.status === 'delivered') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: '🎉 Product already delivered successfully!',
            already_delivered: true,
            order: {
              id: order.id,
              customer_name: currentOrder.customer_name,
              total: currentOrder.total,
              payment_status: currentOrder.payment_status,
              delivered_at: currentOrder.delivered_at
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unable to complete delivery. Order may no longer be in assigned status.',
          details: `Current order status: ${currentOrder?.status || 'unknown'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Order marked as delivered successfully!');

    // Create earnings record for this completion
    const { error: earningsError } = await supabaseClient
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id: order.id,
        amount: payout_amount,
        status: 'completed',
        description: `QR delivery payout - ${payment_method}`
      });

    if (earningsError) {
      console.error('❌ Earnings creation error:', earningsError);
      // Don't fail the delivery for earnings issues
    } else {
      console.log('✅ Earnings record created:', { amount: payout_amount });
    }

    // Update delivery_history with actual payout data
    const { error: historyUpdateError } = await supabaseClient
      .from('delivery_history')
      .update({
        delivery_payout: payout_amount,
        distance_traveled: distance_km,
        updated_at: now
      })
      .eq('order_id', order.id);

    if (historyUpdateError) {
      console.error('❌ Delivery history update error:', historyUpdateError);
      // Don't fail the delivery for history update issues
    } else {
      console.log('✅ Delivery history updated with payout:', { payout_amount, distance_km });
    }

    // Update agent wallet
    const { data: existingWallet } = await supabaseClient
      .from('agent_wallet')
      .select('balance')
      .eq('agent_id', agent.id)
      .maybeSingle();

    const currentBalance = existingWallet?.balance || 0;
    const newBalance = currentBalance + payout_amount;

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
      console.error('❌ Wallet update error:', walletError);
    } else {
      console.log('✅ Wallet updated:', { newBalance });
    }

    // Create wallet transaction
    const { error: transactionError } = await supabaseClient
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id: order.id,
        amount: payout_amount,
        transaction_type: 'delivery_payment',
        description: `QR delivery completed - ${payment_method}`
      });

    if (transactionError) {
      console.error('❌ Transaction creation error:', transactionError);
    }

    console.log('🎉 QR Delivery completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Product delivered successfully! 🎉',
        order: {
          id: order.id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          agent_name: agent.name,
          completed_at: now,
          payout_amount: payout_amount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ QR Complete Delivery Error - Full Details:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});