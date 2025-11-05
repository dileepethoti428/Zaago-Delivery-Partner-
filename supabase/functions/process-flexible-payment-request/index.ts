import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Processing flexible payment request...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { request_id } = await req.json();
    
    // Validate request_id
    if (!request_id) {
      console.error('❌ Missing request_id');
      throw new Error('request_id is required');
    }

    console.log('📋 Request ID:', request_id);

    // Get the payment request with validation
    const { data: paymentRequest, error: fetchError } = await supabaseClient
      .from('flexible_payment_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !paymentRequest) {
      console.error('❌ Failed to fetch payment request:', fetchError);
      throw new Error('Payment request not found');
    }

    // Validate request status (only process pending requests)
    if (paymentRequest.status !== 'pending') {
      console.error('❌ Invalid request status:', paymentRequest.status);
      throw new Error(`Invalid request status: ${paymentRequest.status}`);
    }

    // Validate expiry and extend if too close (Razorpay requires at least 2 minutes future)
    const now = new Date();
    const expiresAt = new Date(paymentRequest.expires_at);
    const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60);
    
    let finalExpiresAt = expiresAt;
    
    // If expired, fail the request
    if (minutesUntilExpiry < 0) {
      console.error('❌ Payment request has expired');
      await supabaseClient
        .from('flexible_payment_requests')
        .update({ status: 'failed', error_message: 'Request expired' })
        .eq('id', request_id);
      throw new Error('Payment request has expired');
    }
    
    // If expiry is less than 5 minutes away, extend it to 15 minutes from now
    // Razorpay requires at least 2 minutes, but we add buffer for processing delays
    if (minutesUntilExpiry < 5) {
      console.log(`⚠️ Expiry too close (${minutesUntilExpiry.toFixed(1)} min), extending to 15 minutes from now`);
      finalExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      
      // Update the payment request with new expiry
      await supabaseClient
        .from('flexible_payment_requests')
        .update({ expires_at: finalExpiresAt.toISOString() })
        .eq('id', request_id);
    }

    console.log('✅ Found valid payment request:', paymentRequest);

    // Update status to generating
    await supabaseClient
      .from('flexible_payment_requests')
      .update({ status: 'generating' })
      .eq('id', request_id);

    // Generate Razorpay QR code
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials not configured');
      await supabaseClient
        .from('flexible_payment_requests')
        .update({ 
          status: 'failed',
          error_message: 'Razorpay credentials not configured'
        })
        .eq('id', request_id);
      throw new Error('Razorpay credentials not configured');
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const amountInPaise = Math.round(parseFloat(paymentRequest.amount) * 100);

    console.log('💰 Creating Razorpay QR for amount:', amountInPaise, 'paise');

    const qrResponse = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'upi_qr',
        name: 'Agent Wallet Top-up',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: amountInPaise,
        description: `Wallet top-up for agent ${paymentRequest.agent_id}`,
        notes: {
          agent_id: paymentRequest.agent_id
        },
        close_by: Math.floor(finalExpiresAt.getTime() / 1000),
      }),
    });

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('❌ Razorpay QR creation failed:', errorText);
      
      await supabaseClient
        .from('flexible_payment_requests')
        .update({ 
          status: 'failed',
          error_message: `Razorpay error: ${errorText}`
        })
        .eq('id', request_id);
      
      throw new Error(`Failed to create Razorpay QR: ${errorText}`);
    }

    const qrData = await qrResponse.json();
    console.log('✅ Razorpay QR created:', qrData.id);

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabaseClient
      .from('flexible_payments')
      .insert({
        agent_id: paymentRequest.agent_id,
        amount: paymentRequest.amount,
        qr_code_id: qrData.id,
        qr_code_url: qrData.image_url,
        status: 'pending',
        expires_at: finalExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error('❌ Failed to create payment record:', paymentError);
      throw paymentError;
    }

    console.log('✅ Payment record created:', paymentRecord.id);

    // Update request with success
    const { error: updateError } = await supabaseClient
      .from('flexible_payment_requests')
      .update({
        status: 'generated',
        qr_url: qrData.image_url,
        payment_id: paymentRecord.id,
      })
      .eq('id', request_id);

    if (updateError) {
      console.error('❌ Failed to update request:', updateError);
      throw updateError;
    }

    console.log('✅ Successfully processed payment request');

    return new Response(
      JSON.stringify({ 
        success: true,
        qr_url: qrData.image_url,
        payment_id: paymentRecord.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing payment request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
