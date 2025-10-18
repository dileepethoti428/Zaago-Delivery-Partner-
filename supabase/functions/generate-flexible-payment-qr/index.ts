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
    const { agent_id, amount } = await req.json();

    if (!agent_id || !amount) {
      throw new Error('Agent ID and amount are required');
    }

    // Validate amount
    if (amount < 10 || amount > 50000) {
      throw new Error('Amount must be between ₹10 and ₹50,000');
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique customer name for tracking
    const customerName = `Agent-${agent_id.substring(0, 8)}-${Date.now()}`;

    // Create QR code with Razorpay
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const response = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'upi_qr',
        name: customerName,
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: amount * 100, // Convert to paise
        description: `Flexible payment collection by delivery agent`,
        close_by: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiry
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Razorpay API error:', errorData);
      throw new Error('Failed to generate payment QR code');
    }

    const qrData = await response.json();
    
    // Store in database
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    const { data: paymentRecord, error: dbError } = await supabase
      .from('flexible_payments')
      .insert({
        agent_id,
        amount,
        razorpay_qr_id: qrData.id,
        qr_code_url: qrData.image_url,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store payment record');
    }

    console.log('✅ Flexible payment QR generated:', {
      payment_id: paymentRecord.id,
      agent_id,
      amount,
      expires_at: expiresAt
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentRecord.id,
        qr_code_url: qrData.image_url,
        qr_id: qrData.id,
        amount,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating flexible payment QR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
