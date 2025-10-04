import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 Manual delivery completion request started');
    
    const body = await req.json();
    const { order_id, payment_method } = body;

    console.log('📋 Manual completion request:', { 
      order_id, 
      payment_method,
      timestamp: new Date().toISOString()
    });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!payment_method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment method is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', userData.user.email);

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

    const normalizedPaymentMethod = payment_method.toUpperCase().includes('COD') || 
                                   payment_method.toUpperCase().includes('CASH') 
                                   ? 'COD' 
                                   : 'ONLINE';

    console.log('📝 Calling manual_complete_delivery function with params:', {
      p_order_id: order_id,
      p_agent_id: agent.id,
      p_payment_method: normalizedPaymentMethod
    });

    const { data: completionResult, error: completionError } = await supabaseClient
      .rpc('manual_complete_delivery', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payment_method: normalizedPaymentMethod
      });

    console.log('📦 RPC Response:', { 
      hasError: !!completionError, 
      hasData: !!completionResult,
      data: completionResult 
    });

    if (completionError) {
      console.error('❌ Manual completion RPC error:', {
        message: completionError.message,
        details: completionError.details,
        hint: completionError.hint,
        code: completionError.code
      });
      
      // FALLBACK: Try ultra-simple completion
      console.log('🚨 Attempting ultra-simple completion as fallback...');
      const { data: simpleResult, error: simpleError } = await supabaseClient
        .rpc('simple_mark_delivered', {
          p_order_id: order_id,
          p_agent_id: agent.id
        });

      if (!simpleError && simpleResult?.success) {
        console.log('✅ Simple completion SUCCESS');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Delivery completed successfully! 🎉',
            method: 'simple_fallback',
            completion_method: 'simple',
            order_id: order_id,
            payment_method: 'COD',
            payment_status: 'cod_collected'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ All completion methods failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'All completion methods failed',
          manual_error: completionError.message,
          simple_error: simpleError?.message || simpleResult?.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!completionResult || !completionResult.success) {
      console.error('❌ Completion function returned error:', {
        result: completionResult,
        success: completionResult?.success,
        error: completionResult?.error
      });
      
      // FALLBACK: Try ultra-simple completion
      console.log('🚨 Attempting ultra-simple completion as fallback...');
      const { data: simpleResult, error: simpleError } = await supabaseClient
        .rpc('simple_mark_delivered', {
          p_order_id: order_id,
          p_agent_id: agent.id
        });

      if (!simpleError && simpleResult?.success) {
        console.log('✅ Simple completion SUCCESS');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Delivery completed successfully! 🎉',
            method: 'simple_fallback',
            completion_method: 'simple',
            order_id: order_id,
            payment_method: 'COD',
            payment_status: 'cod_collected'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ All completion methods failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: completionResult?.error || 'Delivery completion failed',
          details: completionResult,
          simple_error: simpleError?.message || simpleResult?.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Manual delivery completion successful:', {
      order_id: completionResult.order_id,
      payment_method: completionResult.payment_method,
      payout_amount: completionResult.payout_amount
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully! 🎉',
        completion_method: 'manual',
        payout_amount: completionResult.payout_amount,
        payment_method: completionResult.payment_method,
        payment_status: completionResult.payment_status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Manual Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
