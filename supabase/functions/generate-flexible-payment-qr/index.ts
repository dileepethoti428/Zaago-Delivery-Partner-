import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔵 [FLEX-QR-GEN] Function invoked', {
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    console.log('✅ [FLEX-QR-GEN] CORS preflight handled');
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
      console.error('❌ [FLEX-QR-GEN] No authorization header');
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
      console.error('❌ [FLEX-QR-GEN] Invalid token', userError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid authentication' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [FLEX-QR-GEN] User authenticated:', user.email);

    // Parse and validate request
    const { agent_id, amount } = await req.json();
    
    if (!agent_id) {
      throw new Error('Agent ID is required');
    }
    
    if (!amount || typeof amount !== 'number') {
      throw new Error('Valid amount is required');
    }
    
    if (amount < 10 || amount > 50000) {
      throw new Error('Amount must be between ₹10 and ₹50,000');
    }

    console.log('📝 [FLEX-QR-GEN] Request validated', { agent_id, amount });

    // Verify agent authorization
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, email, is_active')
      .eq('id', agent_id)
      .eq('email', user.email)
      .single();

    if (agentError || !agent) {
      console.error('❌ [FLEX-QR-GEN] Agent not found', agentError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Agent not found or unauthorized' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agent.is_active) {
      console.error('❌ [FLEX-QR-GEN] Agent inactive');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Agent account is inactive' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [FLEX-QR-GEN] Agent verified:', agent.email);

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ [FLEX-QR-GEN] Razorpay credentials missing');
      throw new Error('Payment gateway not configured');
    }

    // Create Razorpay QR code
    const closeBy = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes
    const customerRef = `FLEX-${agent_id.substring(0, 8)}-${Date.now()}`;

    console.log('🔄 [FLEX-QR-GEN] Creating Razorpay QR', {
      amount,
      closeBy: new Date(closeBy * 1000).toISOString()
    });

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'upi_qr',
        name: customerRef,
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(amount * 100), // Convert to paise
        description: 'Flexible payment collection',
        close_by: closeBy,
      }),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ [FLEX-QR-GEN] Razorpay API error:', errorText);
      throw new Error('Failed to generate payment QR code');
    }

    const qrData = await razorpayResponse.json();
    console.log('✅ [FLEX-QR-GEN] Razorpay QR created:', qrData.id);

    // Store payment record
    const expiresAt = new Date(closeBy * 1000);
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
      console.error('❌ [FLEX-QR-GEN] Database error:', dbError);
      throw new Error('Failed to create payment record');
    }

    console.log('✅ [FLEX-QR-GEN] Payment record created:', paymentRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentRecord.id,
        qr_code_url: qrData.image_url,
        amount,
        expires_at: expiresAt.toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [FLEX-QR-GEN] Error:', error.message);
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