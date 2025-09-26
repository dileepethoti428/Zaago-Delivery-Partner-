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
          message: 'Order already delivered',
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

    if (!order || order.status !== 'assigned') {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not ready for delivery' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if order is assigned to this agent
    if (order.agent_id !== agent.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order is not assigned to you. Only the assigned delivery agent can complete this order.'
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

    // Enhanced logging for better debugging
    const distance_km = 2.5; // Default distance for QR deliveries
    const payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 12;

    console.log('📊 QR Delivery Context:', {
      qr_code_data: qr_code_data.substring(0, 20) + '...',
      order_id: order.id,
      agent_id: agent.id,
      agent_name: agent.name,
      customer_name: order.customer_name,
      order_total: order.total,
      payment_method: payment_method,
      order_status: order.status,
      payout_amount: payout_amount
    });

    // Handle delivery completion with direct database operations to bypass read-only constraints
    console.log('💾 Completing delivery with direct operations...');
    
    try {
      // Validate amount before any database operations
      const validatedAmount = Number(payout_amount) || 0;
      
      if (validatedAmount <= 0) {
        console.error('❌ Invalid payout amount:', { payout_amount, validatedAmount });
        throw new Error(`Invalid payout amount: ${payout_amount}`);
      }
      
      console.log('💰 Validated payout amount:', validatedAmount);
      
      // Update order status directly
      const { error: orderUpdateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .eq('agent_id', agent.id);
      
      if (orderUpdateError) {
        console.error('❌ Order update failed:', orderUpdateError);
        throw new Error(`Order update failed: ${orderUpdateError.message}`);
      }
      
      console.log('✅ Order status updated to delivered');
      
      // Update agent wallet balance
      const { data: existingWallet } = await supabaseClient
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', agent.id)
        .single();
      
      const currentBalance = existingWallet?.balance || 0;
      const newBalance = Number(currentBalance) + validatedAmount;
      
      console.log('💳 Wallet update:', { currentBalance, validatedAmount, newBalance });
      
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
        console.log('⚠️ Wallet update warning:', walletError);
      } else {
        console.log('✅ Agent wallet updated with payout');
      }
      
      // Create earnings record with validated amount
      const { error: earningsError } = await supabaseClient
        .from('earnings')
        .insert({
          agent_id: agent.id,
          order_id: order.id,
          amount: validatedAmount,
          status: 'completed',
          description: `QR delivery payout: ${distance_km}km`
        });
      
      if (earningsError) {
        console.log('⚠️ Earnings record warning:', earningsError);
      } else {
        console.log('✅ Earnings record created');
      }
      
      // Create wallet transaction with validated amount
      const { error: transactionError } = await supabaseClient
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agent.id,
          order_id: order.id,
          amount: validatedAmount,
          transaction_type: 'delivery_payment',
          description: 'QR delivery completion payout'
        });
      
      if (transactionError) {
        console.log('⚠️ Transaction record warning:', transactionError);
      } else {
        console.log('✅ Wallet transaction recorded');
      }
      
      console.log('✅ QR Delivery completed successfully with payout:', payout_amount);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Order completed successfully via QR scan!',
          order: {
            id: order.id,
            customer_name: order.customer_name,
            total: order.total,
            payment_method,
            distance_km,
            payout_amount: payout_amount,
            agent_name: agent.name
          },
          delivery_details: {
            completed_at: new Date().toISOString(),
            completed_by: agent.name,
            method: 'QR_SCAN'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (directOpError) {
      console.error('❌ Direct operations failed:', directOpError);
      
      // Check if it's a database constraint error
      const errorMessage = directOpError instanceof Error ? directOpError.message : String(directOpError);
      const isConstraintError = errorMessage.includes('violates not-null constraint') || 
                               errorMessage.includes('null value in column');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: isConstraintError ? 'Database validation error - invalid payout amount' : 'Failed to complete delivery',
          code: isConstraintError ? 'AMOUNT_VALIDATION_FAILED' : 'DIRECT_OP_FAILED',
          details: errorMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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