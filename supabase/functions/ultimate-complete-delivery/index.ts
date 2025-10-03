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
    console.log('🚀 Ultimate delivery completion started');

    // Parse request body
    const { order_id, payment_method, customer_location, agent_location } = await req.json();
    console.log('📋 Processing order:', { order_id, payment_method });

    if (!order_id || !payment_method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.email);

    // Get agent details
    const { data: agent, error: agentError } = await supabaseService
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Check if completion already exists
    const { data: existingCompletion } = await supabaseService
      .from('delivery_completions')
      .select('id, status')
      .eq('order_id', order_id)
      .eq('agent_id', agent.id)
      .maybeSingle();

    if (existingCompletion) {
      console.log('✅ Completion already exists:', existingCompletion.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order already completed',
          completion_id: existingCompletion.id,
          status: existingCompletion.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance and payout
    let distance_km = 0;
    let payout_amount = 40; // Base payout

    if (customer_location && agent_location) {
      // Simple distance calculation (can be enhanced)
      const lat1 = customer_location.latitude;
      const lon1 = customer_location.longitude;
      const lat2 = agent_location.latitude;
      const lon2 = agent_location.longitude;
      
      if (lat1 && lon1 && lat2 && lon2) {
        // Haversine formula for distance
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance_km = R * c;
        
        // Calculate payout based on distance
        if (distance_km > 5) {
          payout_amount += (distance_km - 5) * 9; // ₹9 per km after 5km
        }
      }
    }

    console.log('📏 Distance calculated:', distance_km, 'km, Payout:', payout_amount);

    // Create delivery completion record
    const { data: completion, error: completionError } = await supabaseService
      .from('delivery_completions')
      .insert({
        order_id,
        agent_id: agent.id,
        payment_method,
        customer_location,
        agent_location,
        distance_km,
        payout_amount,
        status: 'completed',
        metadata: {
          user_email: user.email,
          completed_via: 'ultimate-complete-delivery',
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (completionError) {
      console.error('❌ Failed to create completion:', completionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create completion record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Completion record created:', completion.id);

    // Update agent wallet
    const { error: walletError } = await supabaseService
      .from('agent_wallet')
      .upsert({
        agent_id: agent.id,
        balance: payout_amount,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_id',
        ignoreDuplicates: false
      });

    if (walletError) {
      console.error('⚠️ Wallet update failed:', walletError);
      // Don't fail the completion for wallet errors
    } else {
      console.log('✅ Wallet updated with payout:', payout_amount);
    }

    // Create earning record
    const { error: earningError } = await supabaseService
      .from('earnings')
      .insert({
        agent_id: agent.id,
        order_id,
        amount: payout_amount,
        distance_km: distance_km,
        status: 'completed',
        description: `Delivery completion: ${distance_km.toFixed(2)}km`
      });

    if (earningError) {
      console.error('⚠️ Earning record failed:', earningError);
      // Don't fail the completion for earning errors
    } else {
      console.log('✅ Earning record created');
      
      // Update delivery_history with actual payout data
      const { error: historyUpdateError } = await supabaseService
        .from('delivery_history')
        .update({
          delivery_payout: payout_amount,
          distance_traveled: distance_km,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', order_id);

      if (historyUpdateError) {
        console.log('⚠️ Delivery history update failed, continuing:', historyUpdateError);
      } else {
        console.log('✅ Delivery history updated with payout');
      }
    }

    // Create wallet transaction
    const { error: transactionError } = await supabaseService
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        order_id,
        amount: payout_amount,
        transaction_type: 'delivery_payment',
        description: 'Delivery completion payout',
        status: 'completed'
      });

    if (transactionError) {
      console.error('⚠️ Transaction record failed:', transactionError);
      // Don't fail the completion for transaction errors
    } else {
      console.log('✅ Transaction record created');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully online!',
        completion_id: completion.id,
        payout_amount,
        distance_km,
        status: 'completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Ultimate completion error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});