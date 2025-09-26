import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Ultra-simple delivery completion request started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online', distance_km = 1, agent_payout = 12 } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, distance_km, agent_payout });
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required', code: 'MISSING_ORDER_ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication', code: 'AUTH_INVALID' }),
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
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive', code: 'AGENT_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Get the order to validate
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, customer_name, total, agent_id')
      .eq('id', order_id)
      .eq('agent_id', agent.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or not assigned to this agent', code: 'ORDER_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered', code: 'ALREADY_DELIVERED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Order validated:', { id: order.id, status: order.status, customer: order.customer_name });

    // Determine payment status
    const payment_status = payment_method.toUpperCase() === 'COD' ? 'paid_cod' : 'paid_online';
    
    console.log('💾 Using ultra-simple delivery completion...');
    
    // Use the new ultra-simple stored procedure
    const { data: result, error: completionError } = await supabaseClient.rpc('ultra_simple_complete_delivery', {
      p_order_id: order_id,
      p_agent_id: agent.id,
      p_payment_status: payment_status
    });
        
    if (completionError) {
      console.error('❌ Delivery completion failed:', completionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to complete delivery',
          code: 'COMPLETION_FAILED',
          details: completionError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!result || !result.success) {
      const errorMsg = result?.error || 'Unknown error during completion';
      console.error('❌ Completion procedure returned error:', errorMsg);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMsg,
          code: 'PROCEDURE_FAILED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Delivery completed successfully');

    // Optional: Create earnings record (non-blocking)
    try {
      const { error: earningsError } = await supabaseClient
        .from('earnings')
        .upsert({
          agent_id: agent.id,
          order_id: order_id,
          amount: distance_km <= 1 ? 12 : Math.round(12 + (distance_km - 1) * 8),
          status: 'completed',
          distance_km: distance_km,
          payment_method: payment_method === 'COD' ? 'COD' : 'Online',
          description: `Delivery completed: ${distance_km}km, ${payment_method} payment`
        }, {
          onConflict: 'agent_id,order_id',
          ignoreDuplicates: true
        });
      
      if (!earningsError) {
        console.log('✅ Earnings record created');
      }
      
      // Update delivery history if exists
      await supabaseClient
        .from('delivery_history')
        .update({
          distance_traveled: distance_km,
          delivery_payout: distance_km <= 1 ? 12 : Math.round(12 + (distance_km - 1) * 8)
        })
        .eq('order_id', order_id)
        .eq('agent_id', agent.id);
        
    } catch (error) {
      console.warn('⚠️ Earnings update failed (non-critical):', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method: payment_method,
          status: 'delivered',
          distance_km: distance_km,
          payout_amount: distance_km <= 1 ? 12 : Math.round(12 + (distance_km - 1) * 8)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});