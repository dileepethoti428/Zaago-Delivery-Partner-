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
    const { order_id, payment_method = 'Online', distance_km = 1, agent_payout = 20 } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, distance_km, agent_payout });
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required', code: 'MISSING_ORDER_ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Supabase client
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
      console.error('❌ Authentication failed:', authError);
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
      console.error('❌ Agent lookup failed:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive', code: 'AGENT_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Use the unified complete_delivery_simple function
    console.log('💾 Using unified delivery completion function...');
    
    const { data: completionResult, error: completionError } = await supabaseClient.rpc('complete_delivery_simple', {
      p_order_id: order_id,
      p_agent_id: agent.id,
      p_payout_amount: agent_payout,
      p_distance_km: distance_km,
      p_payment_method: payment_method
    });
      
    if (completionError) {
      console.error('❌ Delivery completion failed:', completionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to complete delivery',
          code: 'UPDATE_FAILED',
          details: completionError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!completionResult?.success) {
      console.error('❌ Completion function returned failure:', completionResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: completionResult?.error || 'Unknown completion error',
          code: 'COMPLETION_FAILED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Delivery completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          payment_method: payment_method,
          status: 'delivered',
          distance_km: distance_km,
          payout_amount: completionResult.payout_amount || agent_payout
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