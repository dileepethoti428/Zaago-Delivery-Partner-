import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const { order_id, otp_code, payment_method } = await req.json();

    if (!order_id || !otp_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID and OTP are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate the delivery agent
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Verifying OTP for order:', order_id, 'Agent:', agent.name);

    // Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is assigned to this agent
    if (order.agent_id !== agent.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not assigned to you' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (order.otp_verified) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order already verified and completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check OTP attempts limit (max 3 attempts)
    if (order.otp_attempts >= 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Maximum OTP attempts exceeded. Please contact support.',
          attempts_exceeded: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP has expired
    if (order.otp_expires_at && new Date(order.otp_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OTP has expired. Please request a new OTP.',
          expired: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify OTP matches
    if (order.delivery_otp !== otp_code) {
      // Increment attempt counter
      await supabaseAdmin
        .from('orders')
        .update({ 
          otp_attempts: (order.otp_attempts || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id);

      const attemptsLeft = 3 - ((order.otp_attempts || 0) + 1);
      
      console.log('❌ Invalid OTP provided. Attempts left:', attemptsLeft);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
          attempts_left: attemptsLeft
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ OTP verified successfully! Completing delivery...');

    // OTP is correct - complete the delivery
    const { data: completionData, error: completionError } = await supabaseClient.functions.invoke(
      'simple-complete-delivery',
      {
        body: {
          order_id: order_id,
          payment_method: payment_method || 'COD'
        }
      }
    );

    if (completionError || !completionData?.success) {
      console.error('❌ Delivery completion failed:', completionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: completionData?.error || 'Failed to complete delivery'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('orders')
      .update({
        otp_verified: true,
        otp_verified_at: new Date().toISOString(),
        otp_verified_by: agent.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    console.log('✅ Delivery completed successfully via OTP verification');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully',
        payout_amount: completionData.payout_amount,
        order_id: order_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in verify-delivery-otp:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});