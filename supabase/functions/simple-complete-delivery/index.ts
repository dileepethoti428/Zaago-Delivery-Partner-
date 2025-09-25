import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const body = await req.json();
    const { order_id, payment_method = 'Online' } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get agent info
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Simple order status update - this is the core operation
    const updateData = {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online'
    };
    
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update order status',
          details: updateError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Basic payout calculation (fallback)
    const basicPayout = 25;

    // Update agent stats (basic)
    try {
      const { data: currentAgent } = await supabaseClient
        .from('delivery_agents')
        .select('total_deliveries, total_earnings')
        .eq('id', agent.id)
        .single();

      if (currentAgent) {
        await supabaseClient
          .from('delivery_agents')
          .update({
            total_deliveries: (currentAgent.total_deliveries || 0) + 1,
            total_earnings: (currentAgent.total_earnings || 0) + basicPayout,
            last_delivery_at: new Date().toISOString()
          })
          .eq('id', agent.id);
      }
    } catch (statsError) {
      console.warn('Agent stats update failed:', statsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          payout_amount: basicPayout,
          distance_km: 2.5,
          payment_method
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Simple delivery completion failed',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});