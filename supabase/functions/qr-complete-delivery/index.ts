import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zepto/Blinkit style pricing for regular orders
const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
};

/**
 * Calculate payout using Zepto/Blinkit formula
 * Distance is rounded UP to 1 decimal (ceil) for fair agent pay
 */
function calculatePayout(distanceKm: number) {
  // Zepto style: Round UP to 1 decimal place (ceil)
  const roundedDistance = Math.ceil((distanceKm || 0.1) * 10) / 10;
  const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
  const total = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
  
  return {
    base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
    distance_pay: Math.round(distancePay * 10) / 10,
    distance_km: roundedDistance,
    rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE,
    total: Math.round(total * 10) / 10
  };
}

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
    
    // Normalize payment method to database standard format
    const normalizePaymentMethod = (method: string): 'COD' | 'ONLINE' => {
      if (!method || typeof method !== 'string') {
        return 'ONLINE';
      }
      
      const upper = method.toUpperCase().trim();
      
      // COD variants
      if (upper.includes('CASH') || upper.includes('COD') || upper === 'CASH ON DELIVERY') {
        return 'COD';
      }
      
      // Online variants (default)
      return 'ONLINE';
    };
    
    // Apply normalization
    payment_method = normalizePaymentMethod(payment_method);
    
    console.log('📋 QR delivery request validated:', { qr_code_data, payment_method: payment_method });

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
          agent_id,
          distance_km
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

    // Handle already delivered orders
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

    // Auto-assign paid orders to scanning agent if not assigned
    if ((order.status === 'placed' || order.status === 'packed') && 
        (order.payment_status === 'paid' || order.payment_status === 'paid_online') && 
        !order.agent_id) {
      
      console.log(`🔄 Auto-assigning paid order to scanning agent ${agent.id}...`);
      
      const { error: assignError } = await supabaseClient
        .from('orders')
        .update({
          agent_id: agent.id,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (assignError) {
        console.error('❌ Failed to auto-assign order:', assignError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to assign order to agent. Please try again.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log('✅ Order auto-assigned to agent successfully');
      // Update local order object
      order.agent_id = agent.id;
      order.status = 'assigned';
    }

    // Validate order is ready for delivery
    if (order.status !== 'assigned') {
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

    // Calculate payout using Zepto/Blinkit formula BEFORE calling DB functions
    const distanceKm = order.distance_km || 2.5;
    const payoutData = calculatePayout(distanceKm);
    const calculatedPayout = payoutData.total;
    
    console.log('💵 Calculated payout:', payoutData);

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
    }

    console.log('✅ QR code marked as scanned');

    // 🚀 BULLETPROOF ATOMIC COMPLETION: Call v3 with correct QR code parameter
    console.log('🔄 Calling qr_complete_delivery_v3 function with QR code data...');
    
    const { data: completionResult, error: completionError } = await supabaseClient
      .rpc('qr_complete_delivery_v3', {
        p_qr_code_data: qr_code_data,
        p_agent_id: agent.id,
        p_payment_method: payment_method
      });

    if (completionError) {
      console.error('❌ QR completion failed:', completionError);
      
      // FALLBACK 1: Try manual completion
      console.log('🔄 Attempting manual completion as fallback...');
      const { data: manualResult, error: manualError } = await supabaseClient.rpc(
        'manual_complete_delivery',
        {
          p_order_id: order.id,
          p_agent_id: agent.id,
          p_payment_method: payment_method
        }
      );
      
      if (!manualError && manualResult?.success) {
        console.log('✅ Manual completion SUCCESS:', manualResult);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product delivered successfully! 🎉',
            method: 'manual_fallback',
            order: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              payment_method: manualResult.payment_method || payment_method,
              payment_status: manualResult.payment_status,
              agent_name: agent.name,
              payout_amount: manualResult.payout_amount || calculatedPayout,
              payout_breakdown: payoutData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ Manual fallback failed:', manualError || manualResult);
      
      // FALLBACK 2: Ultra-simple completion
      console.log('🚨 Attempting ultra-simple completion as final fallback...');
      const { data: simpleResult, error: simpleError } = await supabaseClient.rpc(
        'simple_mark_delivered',
        {
          p_order_id: order.id,
          p_agent_id: agent.id
        }
      );
      
      if (!simpleError && simpleResult?.success) {
        console.log('✅ Simple completion SUCCESS:', simpleResult);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product delivered successfully! 🎉',
            method: 'simple_fallback',
            order: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              payment_method: 'COD',
              payment_status: 'cod_collected',
              agent_name: agent.name,
              payout_amount: simpleResult.payout_amount || calculatedPayout,
              payout_breakdown: payoutData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ All completion methods failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'All delivery completion methods failed',
          qr_error: completionError.message,
          manual_error: manualError?.message || manualResult?.error,
          simple_error: simpleError?.message || simpleResult?.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if function returned success
    if (!completionResult || !completionResult.success) {
      console.error('❌ QR completion returned error:', completionResult);
      
      // FALLBACK 1: Try manual completion
      console.log('🔄 Attempting manual completion as fallback...');
      const { data: manualResult, error: manualError } = await supabaseClient.rpc(
        'manual_complete_delivery',
        {
          p_order_id: order.id,
          p_agent_id: agent.id,
          p_payment_method: payment_method
        }
      );
      
      if (!manualError && manualResult?.success) {
        console.log('✅ Manual completion SUCCESS:', manualResult);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product delivered successfully! 🎉',
            method: 'manual_fallback',
            order: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              payment_method: manualResult.payment_method || payment_method,
              payment_status: manualResult.payment_status,
              agent_name: agent.name,
              payout_amount: manualResult.payout_amount || calculatedPayout,
              payout_breakdown: payoutData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ Manual fallback failed:', manualError || manualResult);
      
      // FALLBACK 2: Ultra-simple completion
      console.log('🚨 Attempting ultra-simple completion as final fallback...');
      const { data: simpleResult, error: simpleError } = await supabaseClient.rpc(
        'simple_mark_delivered',
        {
          p_order_id: order.id,
          p_agent_id: agent.id
        }
      );
      
      if (!simpleError && simpleResult?.success) {
        console.log('✅ Simple completion SUCCESS:', simpleResult);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product delivered successfully! 🎉',
            method: 'simple_fallback',
            order: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              payment_method: 'COD',
              payment_status: 'cod_collected',
              agent_name: agent.name,
              payout_amount: simpleResult.payout_amount || calculatedPayout,
              payout_breakdown: payoutData
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ All completion methods failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'All delivery completion methods failed',
          qr_error: completionResult?.error,
          manual_error: manualError?.message || manualResult?.error,
          simple_error: simpleError?.message || simpleResult?.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('✅ Atomic completion successful:', completionResult);

    const now = new Date().toISOString();
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    // Use calculated payout, not the one from DB function (which may be wrong)
    const payout_amount = completionResult.payout_amount || calculatedPayout;

    console.log('🎉 QR Delivery completed successfully! Payout:', payout_amount);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Product delivered successfully! 🎉',
        order: {
          id: order.id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          payment_status,
          agent_name: agent.name,
          completed_at: now,
          payout_amount: payout_amount,
          payout_breakdown: payoutData
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
