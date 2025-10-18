import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, payment_method, qr_code_data } = await req.json();

    console.log('🚀 Unified delivery completion request:', { 
      order_id, 
      payment_method, 
      has_qr: !!qr_code_data 
    });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Agent authenticated:', agent.name);

    // Normalize payment method
    const normalizedPayment = payment_method?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'COD';

    let result: any = null;

    // Method 1: Try QR completion if QR code data provided
    if (qr_code_data) {
      console.log('📱 Attempting QR completion...');
      try {
        const { data: qrResult, error: qrError } = await supabase.rpc(
          'qr_complete_delivery_v3',
          {
            p_qr_code_data: qr_code_data,
            p_agent_id: agent.id,
            p_payment_method: normalizedPayment
          }
        );

        if (!qrError && qrResult?.success) {
          console.log('✅ QR completion successful');
          result = qrResult;
        } else {
          console.log('⚠️ QR completion failed, trying manual method');
          console.log('QR Error details:', JSON.stringify(qrError, null, 2));
          console.log('QR Result:', JSON.stringify(qrResult, null, 2));
        }
      } catch (qrErr) {
        console.log('⚠️ QR completion exception, trying manual method:', qrErr);
      }
    }

    // Method 2: Try manual completion if QR failed or not provided
    if (!result) {
      console.log('📝 Attempting manual completion...');
      try {
        const { data: manualResult, error: manualError } = await supabase.rpc(
          'manual_complete_delivery',
          {
            p_order_id: order_id,
            p_agent_id: agent.id,
            p_payment_method: normalizedPayment
          }
        );

        if (!manualError && manualResult?.success) {
          console.log('✅ Manual completion successful');
          result = manualResult;
        } else {
          console.log('⚠️ Manual completion failed, trying simple method');
          console.log('Manual Error details:', JSON.stringify(manualError, null, 2));
          console.log('Manual Result:', JSON.stringify(manualResult, null, 2));
        }
      } catch (manualErr) {
        console.log('⚠️ Manual completion exception, trying simple method:', manualErr);
      }
    }

    // Method 3: Simple fallback as last resort
    if (!result) {
      console.log('🆘 Attempting simple fallback completion...');
      try {
        const { data: simpleResult, error: simpleError } = await supabase.rpc(
          'simple_mark_delivered',
          {
            p_order_id: order_id,
            p_agent_id: agent.id,
            p_payment_method: normalizedPayment
          }
        );

        if (!simpleError && simpleResult?.success) {
          console.log('✅ Simple completion successful');
          result = simpleResult;
        } else {
          console.error('❌ All completion methods failed');
          console.error('Simple Error details:', JSON.stringify(simpleError, null, 2));
          console.error('Simple Result:', JSON.stringify(simpleResult, null, 2));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'All delivery completion methods failed',
              details: {
                simple_error: simpleError,
                simple_result: simpleResult
              }
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (simpleErr) {
        console.error('❌ Simple completion exception:', simpleErr);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'All delivery completion methods failed',
            details: simpleErr
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return success (including already completed cases)
    console.log('🎉 Delivery completed successfully via unified flow');
    return new Response(
      JSON.stringify({
        success: true,
        message: result.already_completed ? 'Order already completed' : 'Delivery completed successfully',
        order_id,
        method_used: qr_code_data ? 'qr_scan' : 'manual',
        payout_amount: result.payout_amount || 30,
        already_completed: result.already_completed || false,
        ...result
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});