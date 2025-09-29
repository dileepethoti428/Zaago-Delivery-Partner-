import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚨 FORCE DELIVERY COMPLETION - BYPASS MODE INITIATED');
    
    const { order_id, payment_method } = await req.json();
    
    if (!order_id) {
      throw new Error('Order ID is required');
    }

    console.log('⚠️ Force completing order:', order_id, 'with payment:', payment_method);

    // Initialize Supabase client with service role (has elevated permissions)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user?.email) {
      console.error('❌ User authentication failed:', userError);
      throw new Error('Authentication required');
    }

    console.log('✅ User authenticated:', user.email);

    // Get agent details
    const { data: agent } = await supabaseAdmin
      .from('delivery_agents')
      .select('id, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!agent) {
      throw new Error('Agent not found or not active');
    }

    console.log('✅ Agent found:', agent.id);

    // Get current order status
    const { data: currentOrder } = await supabaseAdmin
      .from('orders')
      .select('status, agent_id, total')
      .eq('id', order_id)
      .single();

    if (!currentOrder) {
      throw new Error('Order not found');
    }

    if (currentOrder.agent_id !== agent.id) {
      throw new Error('Order not assigned to this agent');
    }

    if (currentOrder.status === 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order already delivered' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚨 EXECUTING NUCLEAR BYPASS - USING SQL FUNCTION');

    // Use the SQL bypass function that completely avoids JSON validation
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    const { data: bypassResult, error: bypassError } = await supabaseAdmin
      .rpc('force_complete_delivery_bypass', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payment_status: payment_status
      });

    if (bypassError) {
      console.error('❌ Nuclear bypass failed:', bypassError);
      throw new Error(`Nuclear bypass failed: ${bypassError.message}`);
    }

    if (!bypassResult?.success) {
      console.error('❌ Nuclear bypass returned failure:', bypassResult);
      throw new Error(bypassResult?.error || 'Nuclear bypass failed');
    }

    console.log('✅ NUCLEAR BYPASS SUCCESSFUL:', bypassResult);

    // Log the force completion for audit
    await supabaseAdmin
      .from('password_reset_logs')
      .insert({
        email: 'system@zaago.com',
        event_type: 'email_sent',
        metadata: {
          action: 'NUCLEAR_DELIVERY_COMPLETION',
          order_id: order_id,
          agent_id: agent.id,
          agent_email: user.email,
          payment_method: payment_method,
          completion_time: new Date().toISOString(),
          reason: 'Used nuclear SQL bypass due to corrupted JSON data',
          method: 'rpc_function_bypass'
        }
      });

    console.log('✅ FORCE COMPLETION AUDIT LOG CREATED');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Delivery force completed successfully',
        order_id: order_id,
        payment_status: payment_status,
        warning: 'Used force completion bypass method'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Force delivery completion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Force completion failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});