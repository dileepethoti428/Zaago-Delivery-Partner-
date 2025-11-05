import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔵 Check Payment Status function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Manual JWT validation
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payment_id } = await req.json();

    if (!payment_id) {
      throw new Error('Payment ID is required');
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('flexible_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment record not found');
    }

    // If already paid, return status
    if (payment.status === 'paid') {
      return new Response(
        JSON.stringify({ 
          isPaid: true,
          status: 'paid',
          payment_received_at: payment.payment_received_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check with Razorpay
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${payment.razorpay_qr_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Razorpay API error:', errorData);
      throw new Error('Failed to check payment status');
    }

    const qrData = await response.json();
    
    // Check if payment is completed
    const isPaid = qrData.status === 'closed' && qrData.payments_amount_received > 0;

    if (isPaid) {
      // Update payment record
      const { error: updateError } = await supabase
        .from('flexible_payments')
        .update({
          status: 'paid',
          payment_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment_id);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
      }

      // Credit agent wallet
      const { error: walletError } = await supabase
        .from('agent_wallet')
        .upsert({
          agent_id: payment.agent_id,
          balance: supabase.rpc('increment', { x: payment.amount }),
          updated_at: new Date().toISOString(),
        });

      if (walletError) {
        console.error('Failed to update agent wallet:', walletError);
      }

      // Create wallet transaction
      await supabase
        .from('agent_wallet_transactions')
        .insert({
          agent_id: payment.agent_id,
          amount: payment.amount,
          transaction_type: 'flexible_payment',
          description: `Flexible payment collection via QR`,
          status: 'completed',
        });

      console.log('✅ Flexible payment received:', {
        payment_id,
        agent_id: payment.agent_id,
        amount: payment.amount
      });
    }

    return new Response(
      JSON.stringify({ 
        isPaid,
        status: qrData.status,
        amount_received: qrData.payments_amount_received
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking flexible payment status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
