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
    console.log('🎯 Unified delivery completion request started');
    
    const body = await req.json();
    const { order_id, payment_method = 'COD', qr_code_data } = body;

    console.log('📋 Unified completion request:', { 
      order_id, 
      payment_method,
      has_qr_code: !!qr_code_data,
      timestamp: new Date().toISOString()
    });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
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

    // METHOD 1: Try QR completion if QR code provided
    if (qr_code_data) {
      console.log('🎯 METHOD 1: Attempting QR completion with code:', qr_code_data);
      
      const { data: qrResult, error: qrError } = await supabaseClient
        .rpc('qr_complete_delivery_v3', {
          p_qr_code_data: qr_code_data,
          p_agent_id: agent.id,
          p_payment_method: normalizedPaymentMethod
        });

      if (!qrError && qrResult?.success) {
        console.log('✅ QR completion SUCCESS');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Delivery completed via QR scan! 🎉',
            method: 'qr_scan',
            ...qrResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('❌ QR completion failed:', qrError || qrResult);
    }

    // METHOD 2: Try manual completion
    console.log('🎯 METHOD 2: Attempting manual completion...');
    
    const { data: manualResult, error: manualError } = await supabaseClient
      .rpc('manual_complete_delivery', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payment_method: normalizedPaymentMethod
      });

    if (!manualError && manualResult?.success) {
      console.log('✅ Manual completion SUCCESS');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Delivery completed manually! 🎉',
          method: 'manual',
          ...manualResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('❌ Manual completion failed:', manualError || manualResult);

    // METHOD 3: Ultra-simple fallback (nuclear option)
    console.log('🚨 METHOD 3: Attempting ultra-simple fallback...');
    
    const { data: simpleResult, error: simpleError } = await supabaseClient
      .rpc('simple_mark_delivered', {
        p_order_id: order_id,
        p_agent_id: agent.id
      });

    if (!simpleError && simpleResult?.success) {
      console.log('✅ Ultra-simple completion SUCCESS');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Delivery completed! 🎉',
          method: 'simple_fallback',
          order_id: order_id,
          payment_status: 'cod_collected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('❌ All three completion methods failed');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'All completion methods failed. Please contact support.',
        details: {
          qr_error: qr_code_data ? (qrError?.message || qrResult?.error) : 'not attempted',
          manual_error: manualError?.message || manualResult?.error,
          simple_error: simpleError?.message || simpleResult?.error
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );

  } catch (error) {
    console.error('❌ Unified Complete Delivery Error:', error);
    
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
