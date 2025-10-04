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
    console.log('📋 Manual Complete Delivery - Request started');
    
    const body = await req.json();
    const { order_id, payment_method = 'ONLINE' } = body;

    console.log('📦 Request data:', { order_id, payment_method });

    // Validate inputs
    if (!order_id) {
      console.error('❌ Missing order_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No auth header');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error('❌ Auth failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', userData.user.email);

    // Get agent details
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

    // Normalize payment method
    const normalizedPaymentMethod = payment_method.toUpperCase().trim();
    const validPaymentMethod = ['COD', 'ONLINE'].includes(normalizedPaymentMethod) 
      ? normalizedPaymentMethod 
      : 'ONLINE';

    console.log('💳 Payment method:', validPaymentMethod);

    // Call the manual completion database function
    console.log('🔄 Calling manual_complete_delivery function...');
    
    const { data: completionResult, error: completionError } = await supabaseClient
      .rpc('manual_complete_delivery', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payment_method: validPaymentMethod
      });

    if (completionError) {
      console.error('❌ Manual completion RPC failed:', completionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to complete delivery',
          details: completionError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check if function returned success
    if (!completionResult || !completionResult.success) {
      console.error('❌ Completion function returned error:', completionResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: completionResult?.error || 'Manual completion failed',
          details: completionResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Manual delivery completed successfully:', completionResult);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ Delivery completed successfully!',
        completion_method: 'manual',
        order_id: order_id,
        agent_name: agent.name,
        payment_method: validPaymentMethod,
        payout_amount: completionResult.payout_amount || 30,
        completion_id: completionResult.completion_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Manual Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery manually. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
