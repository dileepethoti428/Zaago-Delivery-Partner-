
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
      console.log('Raw request body:', rawBody);
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(rawBody);
      console.log('Parsed request body:', body);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw body that failed to parse:', rawBody);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format. Please ensure request body is valid JSON.',
          details: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          received_body: rawBody
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let { qr_code_data, payment_method = 'prepaid' } = body;
    
    // Enhanced payment method validation and sanitization
    if (!payment_method || typeof payment_method !== 'string') {
      console.log('Invalid payment_method received, defaulting to prepaid:', payment_method);
      payment_method = 'prepaid';
    } else {
      // Clean the payment method string
      payment_method = payment_method.toString().trim();
    }
    
    console.log('QR delivery request validated:', { qr_code_data, payment_method });

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
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get agent info
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

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
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const order = qrData.orders as any;

    // If order already delivered, return success (idempotent)
    if (order && order.status === 'delivered') {
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

    // If QR already used but order not delivered, block
    if (qrData.is_scanned) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR code already used' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
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
          error: 'Order is not assigned to you. Only the assigned delivery agent can complete this order.',
          message: 'This order is assigned to another agent. Please contact support if you believe this is an error.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

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
      console.error('Failed to mark QR as scanned:', scanUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Order status update is now handled by the complete_delivery_simple database function
    console.log('✅ QR code marked as scanned, proceeding with delivery completion via database function');

    // Use the complete_delivery_simple database function for consistent processing
    const distance_km = 2.5; // This should be calculated based on actual delivery route
    let payout_amount = 20; // Default minimum payout
    let completionResult = null;

    try {
      console.log('🔄 Calling complete_delivery_simple RPC with params:', {
        p_order_id: order.id,
        p_agent_id: agent.id,
        p_payout_amount: payout_amount,
        p_distance_km: distance_km,
        p_payment_method: payment_method
      });

      const { data: completionData, error: completionError } = await supabaseClient.rpc('complete_delivery_simple', {
        p_order_id: order.id,
        p_agent_id: agent.id,
        p_payout_amount: payout_amount,
        p_distance_km: distance_km,
        p_payment_method: payment_method
      });

      if (completionError) {
        console.error('❌ QR Delivery completion RPC error:', completionError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to complete delivery', 
            details: completionError.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      if (!completionData || !completionData.success) {
        console.error('❌ QR Completion function returned failure:', completionData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: completionData?.error || 'Unknown completion error',
            details: completionData?.details || 'Delivery completion failed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      completionResult = completionData;
      payout_amount = completionResult.payout_amount || 20;
      console.log('✅ QR Delivery completed successfully with payout:', payout_amount);
      
    } catch (error) {
      console.error('❌ QR Delivery completion failed with exception:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to complete delivery', 
          details: error instanceof Error ? error.message : String(error)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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
          payout_amount,
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

  } catch (error) {
    console.error('QR Complete Delivery Error - Full Details:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('Request method:', req.method);
    console.error('Request URL:', req.url);
    console.error('Request headers:', Object.fromEntries(req.headers.entries()));
    
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
