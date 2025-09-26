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
          error: 'Invalid request format',
          details: parseError instanceof Error ? parseError.message : String(parseError),
          action_required: 'refresh_app',
          user_message: 'Please refresh the app and try again'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id, agent_location, distance_km, agent_payout } = body;
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

    // Enhanced authentication with detailed session validation
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Invalid or missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication required',
          action_required: 'reauth',
          user_message: 'Your session has expired. Please refresh the app and log in again.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token extracted, length:', token.length);
    
    // Enhanced token validation
    if (token.length < 50) {
      console.error('❌ Token appears to be malformed, length:', token.length);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid authentication token',
          action_required: 'reauth',
          user_message: 'Authentication token is invalid. Please refresh the app.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    let userData;
    try {
      const authResult = await supabaseClient.auth.getUser(token);
      userData = authResult.data;
      
      if (authResult.error) {
        console.error('❌ Auth validation error:', authResult.error);
        const isTokenExpired = authResult.error.message?.includes('expired') || 
                               authResult.error.message?.includes('invalid') ||
                               authResult.error.status === 401;
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Authentication failed',
            details: authResult.error.message,
            action_required: isTokenExpired ? 'reauth' : 'retry',
            user_message: isTokenExpired 
              ? 'Your session has expired. Please refresh the app and log in again.'
              : 'Authentication error occurred. Please try again.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
    } catch (authError) {
      console.error('❌ Auth request failed:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication system error',
          action_required: 'retry',
          user_message: 'Authentication system temporarily unavailable. Please try again.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    if (!userData.user) {
      console.error('❌ No user data returned from auth');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User session not found',
          action_required: 'reauth',
          user_message: 'User session not found. Please refresh the app and log in again.'
        }),
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

    // Calculate distance for payout with guaranteed non-null values
    let distance_km_calc = distance_km || 2.5; // Use provided or fallback
    let payout_amount = agent_payout || 35; // Use provided or fallback
    
    console.log('💰 Initial payout calculation:', { distance_km: distance_km_calc, payout_amount });
    
    if (order.address?.coordinates && order.pickup_location) {
      try {
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: order.pickup_location,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km_calc = distanceData.distance_km;
          // Calculate payout: ₹20 base + ₹12/km beyond 1km
          payout_amount = distance_km_calc <= 1 ? 20 : 20 + (distance_km_calc - 1) * 12;
        }
      } catch (distanceError) {
        console.warn('Distance calculation failed, using defaults:', distanceError);
      }
    }
    
    // Ensure payout_amount is never null or zero
    payout_amount = Math.max(payout_amount || 35, 20); // Minimum ₹20
    distance_km_calc = Math.max(distance_km_calc || 2.5, 0.1); // Minimum 0.1km
    
    console.log('💰 Final payout calculation:', { distance_km: distance_km_calc, payout_amount });

    // Use the safe database function to complete delivery
    console.log('💾 Using safe delivery completion function...');
    
    let updateSuccess = false;
    
    try {
      const { data: completionResult, error: completionError } = await supabaseClient.rpc('complete_delivery_simple', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payout_amount: payout_amount,
        p_distance_km: distance_km_calc,
        p_payment_method: payment_method
      });
      
      if (completionError) {
        console.error('❌ Safe completion failed:', completionError);
        throw completionError;
      }
      
      if (!completionResult || !completionResult.success) {
        console.error('❌ Completion function returned failure:', completionResult);
        throw new Error(completionResult?.error || 'Unknown completion error');
      }
      
      console.log('✅ Delivery completed successfully via safe function:', completionResult);
      updateSuccess = true;
      
    } catch (safeError) {
      console.error('❌ Safe completion method failed:', safeError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to complete delivery',
          details: safeError instanceof Error ? safeError.message : String(safeError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Skip manual earnings/stats updates - handled by database function
    console.log('📊 Earnings and agent stats updated by database function');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          distance_km: Math.round(distance_km_calc * 100) / 100,
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