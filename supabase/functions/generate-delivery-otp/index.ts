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
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry time (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    console.log('📝 Generating OTP for order:', order_id, 'OTP:', otp);

    // Update order with new OTP
    const { data: orderData, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        delivery_otp: otp,
        otp_expires_at: expiresAt,
        otp_attempts: 0,
        otp_verified: false,
        otp_verified_at: null,
        otp_verified_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select('id, customer_name, total, delivery_otp')
      .single();

    if (updateError) {
      console.error('❌ Failed to generate OTP:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ OTP generated successfully:', otp, 'Expires at:', expiresAt);

    return new Response(
      JSON.stringify({
        success: true,
        otp: otp,
        expires_at: expiresAt,
        order_id: order_id,
        message: 'OTP generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-delivery-otp:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});