import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔵 [FLEX-STATUS] Function invoked', {
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  if (req.method === 'OPTIONS') {
    console.log('✅ [FLEX-STATUS] CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [FLEX-STATUS] No authorization header');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication required' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ [FLEX-STATUS] Invalid token', userError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid authentication' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [FLEX-STATUS] User authenticated:', user.email);

    // Parse request
    const { payment_id } = await req.json();
    
    if (!payment_id) {
      throw new Error('Payment ID is required');
    }

    console.log('📝 [FLEX-STATUS] Checking payment:', payment_id);

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('flexible_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      console.error('❌ [FLEX-STATUS] Payment not found', paymentError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Payment record not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, email')
      .eq('id', payment.agent_id)
      .eq('email', user.email)
      .single();

    if (agentError || !agent) {
      console.error('❌ [FLEX-STATUS] Unauthorized access');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already paid, return cached status
    if (payment.status === 'paid') {
      console.log('✅ [FLEX-STATUS] Already paid (cached)');
      return new Response(
        JSON.stringify({ 
          success: true,
          isPaid: true,
          status: 'paid',
          amount: payment.amount,
          payment_received_at: payment.payment_received_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(payment.expires_at);
    if (now > expiresAt) {
      console.log('⏱️ [FLEX-STATUS] Payment expired');
      
      // Update status to expired
      await supabase
        .from('flexible_payments')
        .update({ 
          status: 'expired',
          updated_at: now.toISOString()
        })
        .eq('id', payment_id);

      return new Response(
        JSON.stringify({ 
          success: true,
          isPaid: false,
          status: 'expired'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check with Razorpay
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ [FLEX-STATUS] Razorpay credentials missing');
      throw new Error('Payment gateway not configured');
    }

    console.log('🔄 [FLEX-STATUS] Checking Razorpay status');

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const razorpayResponse = await fetch(
      `https://api.razorpay.com/v1/payments/qr_codes/${payment.razorpay_qr_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ [FLEX-STATUS] Razorpay API error:', errorText);
      throw new Error('Failed to check payment status with gateway');
    }

    const qrData = await razorpayResponse.json();
    console.log('📊 [FLEX-STATUS] Razorpay response:', {
      status: qrData.status,
      amount_received: qrData.payments_amount_received
    });
    
    // Check if payment is completed
    const isPaid = qrData.status === 'closed' && qrData.payments_amount_received > 0;

    if (isPaid) {
      console.log('💰 [FLEX-STATUS] Payment received! Processing...');
      
      const paymentReceivedAt = new Date().toISOString();

      // Update payment record
      const { error: updateError } = await supabase
        .from('flexible_payments')
        .update({
          status: 'paid',
          payment_received_at: paymentReceivedAt,
          updated_at: paymentReceivedAt,
        })
        .eq('id', payment_id);

      if (updateError) {
        console.error('❌ [FLEX-STATUS] Failed to update payment:', updateError);
        throw new Error('Failed to update payment status');
      }

      console.log('✅ [FLEX-STATUS] Payment record updated');

      // Get current wallet balance
      const { data: currentWallet } = await supabase
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', payment.agent_id)
        .single();

      const currentBalance = currentWallet?.balance || 0;
      const newBalance = currentBalance + payment.amount;

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('agent_wallet')
        .upsert({
          agent_id: payment.agent_id,
          balance: newBalance,
          updated_at: paymentReceivedAt,
        });

      if (walletError) {
        console.error('❌ [FLEX-STATUS] Failed to update wallet:', walletError);
        throw new Error('Failed to credit wallet');
      }

      console.log('✅ [FLEX-STATUS] Wallet credited:', {
        agent_id: payment.agent_id,
        amount: payment.amount,
        old_balance: currentBalance,
        new_balance: newBalance
      });

      // Create wallet transaction record
      const { error: txnError } = await supabase
        .from('agent_wallet_transactions')
        .insert({
          agent_id: payment.agent_id,
          amount: payment.amount,
          transaction_type: 'flexible_payment',
          description: `Flexible payment collection ₹${payment.amount}`,
          status: 'completed',
          created_at: paymentReceivedAt,
        });

      if (txnError) {
        console.error('⚠️ [FLEX-STATUS] Failed to create transaction record:', txnError);
        // Don't throw - wallet already credited
      } else {
        console.log('✅ [FLEX-STATUS] Transaction record created');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          isPaid: true,
          status: 'paid',
          amount: payment.amount,
          payment_received_at: paymentReceivedAt,
          wallet_balance: newBalance
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment still pending
    console.log('⏳ [FLEX-STATUS] Payment still pending');
    return new Response(
      JSON.stringify({ 
        success: true,
        isPaid: false,
        status: qrData.status,
        amount_received: qrData.payments_amount_received
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [FLEX-STATUS] Error:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});