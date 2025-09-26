
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

    // Update order status to delivered
    console.log('Updating order status for order:', order.id);
    
    // Prepare update data with validation
    const updateData = {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online'
    };
    
    console.log('Update data prepared:', JSON.stringify(updateData));
    
    try {
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (updateError) {
        console.error('Failed to update order:', updateError);
        console.error('Update data that failed:', JSON.stringify(updateData));
        console.error('Order ID:', order.id);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update order status', 
            details: updateError.message,
            debug_info: { 
              order_id: order.id, 
              payment_method, 
              updateData,
              error_code: updateError.code,
              error_details: updateError.details
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log('Order status updated successfully');
    } catch (dbError) {
      console.error('Database operation failed with exception:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database operation failed', 
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Use the simple delivery completion function with better error handling
    const distance_km = 2.5; // This should be calculated based on actual delivery route
    let payout_amount = 12; // Default fallback - use let for reassignment
    let completionResult = null;

    try {
      // Calculate payout amount
      payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 12;
      
      console.log('Calling complete_delivery_simple RPC with params:', {
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
        console.error('Delivery completion RPC error:', {
          message: completionError.message,
          code: completionError.code,
          details: completionError.details
        });
        
        // Don't throw here - the order is already marked as delivered, 
        // just log the payout issue and continue
        console.warn('Payout processing failed but order is delivered');
        payout_amount = 12; // Use fallback
      } else {
        completionResult = completionData;
        payout_amount = completionResult?.payout_amount || completionResult?.total_payout || 12;
        console.log('Delivery completed successfully with payout:', payout_amount);
      }
    } catch (error) {
      console.error('Delivery completion failed with exception:', error);
      console.warn('Using fallback payout amount due to completion error');
      payout_amount = 12; // Use fallback and continue
    }

    try {
      const { error: historyUpdateError } = await supabaseClient
        .from('delivery_history')
        .update({
          delivery_notes: `Completed via QR scan by ${agent.name} - Payout: ₹${payout_amount}`,
          distance_traveled: distance_km,
          delivery_payout: payout_amount
        })
        .eq('order_id', order.id);

      if (historyUpdateError) {
        console.warn('Could not update delivery history details:', historyUpdateError);
      }
    } catch (historyError) {
      console.warn('Delivery history update failed:', historyError);
    }

    // Update agent statistics
    try {
      const { data: currentAgent } = await supabaseClient
        .from('delivery_agents')
        .select('total_deliveries, deliveries_today, total_earnings')
        .eq('id', agent.id)
        .single();

      if (currentAgent) {
        await supabaseClient
          .from('delivery_agents')
          .update({
            total_deliveries: (currentAgent.total_deliveries || 0) + 1,
            deliveries_today: (currentAgent.deliveries_today || 0) + 1,
            total_earnings: (currentAgent.total_earnings || 0) + order.total,
            last_delivery_at: new Date().toISOString()
          })
          .eq('id', agent.id);
      }
    } catch (statsError) {
      console.warn('Agent stats update failed:', statsError);
    }

    // Create order tracking record
    try {
      await supabaseClient
        .from('order_tracking')
        .insert({
          order_id: order.id,
          status: 'delivered',
          timestamp: new Date().toISOString(),
          location: order.address?.coordinates || null,
          notes: `Order delivered via QR scan by ${agent.name}`
        });
    } catch (trackingError) {
      console.warn('Order tracking creation failed:', trackingError);
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
