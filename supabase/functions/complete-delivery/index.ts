import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Complete delivery request started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body with detailed logging
    let body;
    try {
      const rawBody = await req.text();
      console.log('📥 Raw request body length:', rawBody.length);
      
      if (!rawBody || rawBody.trim() === '') {
        console.error('❌ Empty request body received');
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(rawBody);
      console.log('✅ Request body parsed successfully, keys:', Object.keys(body));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format. Please ensure request body is valid JSON.',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id, agent_location } = body;
    let { payment_method } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, has_agent_location: !!agent_location });
    
    // Validate required parameters
    if (!order_id) {
      console.error('❌ Missing order_id in request');
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Validate and normalize payment method
    if (!payment_method || typeof payment_method !== 'string') {
      payment_method = 'Online';
    } else {
      payment_method = payment_method.toString().trim();
    }
    
    const validPaymentMethods = ['Online', 'COD', 'UPI', 'Card'];
    if (!validPaymentMethods.includes(payment_method)) {
      console.warn('⚠️ Invalid payment method provided:', payment_method, 'using Online as fallback');
      payment_method = 'Online';
    }

    console.log('💳 Using payment method:', payment_method);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user with detailed logging
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required - no authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token extracted, length:', token.length);
    
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed', details: authError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    if (!userData.user) {
      console.error('❌ No user data returned from auth');
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    console.log('✅ User authenticated:', userData.user.email);

    // Get agent info with detailed logging
    console.log('👤 Looking up agent for email:', userData.user.email);
    
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name, is_active')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError) {
      console.error('❌ Agent lookup error:', agentError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Agent lookup failed', 
          details: agentError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!agent) {
      console.error('❌ No active agent found for email:', userData.user.email);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    
    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Get order details with detailed logging and JSON validation
    console.log('📦 Looking up order:', order_id);
    
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError) {
      console.error('❌ Order lookup error:', orderError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order lookup failed', 
          details: orderError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!order) {
      console.error('❌ Order not found:', order_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    console.log('✅ Order found:', { id: order.id, status: order.status, customer: order.customer_name });

    // Validate and sanitize JSON fields to prevent parsing errors
    try {
      // Ensure address is valid JSON
      if (order.address && typeof order.address === 'string') {
        try {
          order.address = JSON.parse(order.address);
        } catch (e) {
          console.warn('⚠️ Invalid address JSON, setting to null');
          order.address = null;
        }
      }
      
      // Ensure pickup_location is valid JSON
      if (order.pickup_location && typeof order.pickup_location === 'string') {
        try {
          order.pickup_location = JSON.parse(order.pickup_location);
        } catch (e) {
          console.warn('⚠️ Invalid pickup_location JSON, setting to null');
          order.pickup_location = null;
        }
      }
      
      // Ensure items is valid JSON array
      if (order.items && typeof order.items === 'string') {
        try {
          order.items = JSON.parse(order.items);
        } catch (e) {
          console.warn('⚠️ Invalid items JSON, setting to empty array');
          order.items = [];
        }
      }
      
      console.log('✅ Order JSON fields validated and cleaned');
      
    } catch (validationError) {
      console.error('❌ Order validation failed:', validationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order data validation failed', 
          details: validationError instanceof Error ? validationError.message : String(validationError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check if order is already delivered
    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance for payout
    let distance_km = 2.5; // Default fallback
    let payout_amount = 35; // Default fallback
    
    if (order.address?.coordinates && order.pickup_location) {
      try {
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: order.pickup_location,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km = distanceData.distance_km;
          // Calculate payout: ₹20 base + ₹12/km beyond 1km
          payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 12;
        }
      } catch (distanceError) {
        console.warn('Distance calculation failed, using defaults:', distanceError);
      }
    }

    // Update order status to delivered with transaction safety
    console.log('💾 Starting order status update...');
    
    try {
      // Clean special instructions if they contain problematic data
      let cleanInstructions = order.special_instructions;
      if (typeof order.special_instructions === 'string' && order.special_instructions.includes('Peak')) {
        console.log('🧹 Cleaning corrupted special_instructions field');
        cleanInstructions = null;
      }

      // Use a single update operation for atomicity
      const updatePayload = {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online',
        special_instructions: cleanInstructions,
        pickup_address: null // Clear potentially corrupted field
      };
      
      console.log('📝 Update payload prepared:', Object.keys(updatePayload));

      const { error: updateError } = await supabaseClient
        .from('orders')
        .update(updatePayload)
        .eq('id', order_id);

      if (updateError) {
        console.error('❌ Failed to update order:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update order status', 
            details: updateError.message,
            code: updateError.code
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log('✅ Order status updated successfully');
      
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database operation failed', 
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create earnings record (simple and safe)
    try {
      const { data: existingEarning } = await supabaseClient
        .from('earnings')
        .select('id')
        .eq('agent_id', agent.id)
        .eq('order_id', order_id)
        .single();

      if (!existingEarning) {
        await supabaseClient
          .from('earnings')
          .insert({
            agent_id: agent.id,
            order_id: order_id,
            amount: payout_amount,
            status: 'completed',
            distance_km: distance_km,
            payment_method: payment_method === 'COD' ? 'COD' : 'Online',
            description: `Delivery payout for order ${order_id.substring(0, 8)}`
          });
      }
    } catch (earningsError) {
      console.warn('Earnings creation failed:', earningsError);
    }

    // Update agent statistics (simple approach)
    try {
      const { data: currentAgent } = await supabaseClient
        .from('delivery_agents')
        .select('total_deliveries, total_earnings')
        .eq('id', agent.id)
        .single();

      if (currentAgent) {
        await supabaseClient
          .from('delivery_agents')
          .update({
            total_deliveries: (currentAgent.total_deliveries || 0) + 1,
            total_earnings: (currentAgent.total_earnings || 0) + payout_amount,
            last_delivery_at: new Date().toISOString()
          })
          .eq('id', agent.id);
      }
    } catch (statsError) {
      console.warn('Agent stats update failed:', statsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          distance_km: Math.round(distance_km * 100) / 100,
          payout_amount: Math.round(payout_amount),
          payment_method
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Complete Delivery Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    // Determine if this is a recoverable error
    const isRecoverable = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('connection')
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        details: error instanceof Error ? error.message : String(error),
        recoverable: isRecoverable,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});