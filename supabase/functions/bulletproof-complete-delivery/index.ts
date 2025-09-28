import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔥 Bulletproof delivery completion started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online' } = body;
    
    console.log('📋 Processing order:', { order_id, payment_method });
    
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', userData.user.email);

    // Get agent info
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent lookup failed:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    const now = new Date().toISOString();
    const payment_status = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    // Ultra-simple direct update approach - only update essential fields
    console.log('🔄 Attempting direct minimal update...');
    
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        payment_status: payment_status
      })
      .eq('id', order_id)
      .eq('agent_id', agent.id); // Ensure only assigned agent can complete

    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Update failed: ${updateError.message}`,
          details: updateError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Order status updated successfully');

    // Try to update wallet and earnings, but don't fail if these don't work
    const payout = 25; // Fixed payout
    
    try {
      // Get current balance
      const { data: currentWallet } = await supabaseClient
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', agent.id)
        .single();

      const currentBalance = Number(currentWallet?.balance || 0);
      const newBalance = currentBalance + payout;

      // Update wallet
      const { error: walletError } = await supabaseClient
        .from('agent_wallet')
        .upsert({
          agent_id: agent.id,
          balance: newBalance,
          updated_at: now
        });

      if (!walletError) {
        console.log('✅ Agent wallet updated');
        
        // Add earnings record
        await supabaseClient
          .from('earnings')
          .insert({
            agent_id: agent.id,
            order_id: order_id,
            amount: payout,
            status: 'completed',
            description: 'Delivery payout'
          });
        
        console.log('✅ Earnings record created');

        // Add wallet transaction
        await supabaseClient
          .from('agent_wallet_transactions')
          .insert({
            agent_id: agent.id,
            order_id: order_id,
            amount: payout,
            transaction_type: 'delivery_payment',
            description: 'Delivery completion payout',
            status: 'completed'
          });
          
        console.log('✅ Wallet transaction recorded');
      }
    } catch (walletError) {
      console.log('⚠️ Wallet operations failed but continuing:', walletError);
    }

    console.log('🎉 Delivery completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Product delivered successfully!',
        order: {
          id: order_id,
          status: 'delivered',
          payment_method,
          payment_status,
          payout_amount: payout,
          agent_name: agent.name,
          completed_at: now
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Bulletproof delivery completion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        technical_details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});