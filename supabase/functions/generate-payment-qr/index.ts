import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, amount, customer_name } = await req.json();

    console.log('🔐 Generating Razorpay QR code for order:', order_id, 'Amount:', amount);

    if (!order_id || !amount) {
      throw new Error('Missing required fields: order_id, amount');
    }

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Basic Auth header
    const authString = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    // Generate unique QR code with pre-filled amount
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'upi_qr',
        name: customer_name || 'Customer',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
        description: `Order ${order_id.substring(0, 8)}`,
        close_by: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
      }),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ Razorpay API error:', errorText);
      throw new Error(`Razorpay API error: ${errorText}`);
    }

    const qrData = await razorpayResponse.json();
    
    console.log('✅ Razorpay QR code generated successfully:', qrData.id);
    console.log('🔍 Razorpay QR response fields:', Object.keys(qrData));

    // Always ensure we have a UPI string to render the QR ourselves
    // Razorpay may or may not return qr_string depending on account plan
    let upiString = qrData.qr_string;
    
    if (!upiString) {
      // Construct standard UPI deep link manually
      const RAZORPAY_VPA = Deno.env.get('RAZORPAY_VPA') || 'zaago@razorpay';
      const merchantName = encodeURIComponent('Zaago Delivery');
      const amountStr = amount.toFixed(2);
      const txnNote = encodeURIComponent(`Order ${order_id.substring(0, 8)}`);
      upiString = `upi://pay?pa=${RAZORPAY_VPA}&pn=${merchantName}&am=${amountStr}&cu=INR&tn=${txnNote}&tr=${qrData.id}`;
      console.log('⚠️ qr_string not in Razorpay response, constructed manually:', upiString);
    }

    // Store QR code ID in database for tracking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('orders')
      .update({ 
        razorpay_qr_id: qrData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    return new Response(
      JSON.stringify({
        success: true,
        qr_code_id: qrData.id,
        qr_string: upiString,          // fallback UPI string
        qr_code_url: qrData.image_url, // Razorpay-hosted QR image (preferred)
        amount: amount,
        expires_at: qrData.close_by,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
