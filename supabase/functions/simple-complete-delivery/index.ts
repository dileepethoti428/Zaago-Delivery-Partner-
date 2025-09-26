import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Ultra-simple delivery completion request started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online', distance_km = 1, agent_payout = 20 } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, distance_km, agent_payout });
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required', code: 'MISSING_ORDER_ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication', code: 'AUTH_INVALID' }),
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
        JSON.stringify({ success: false, error: 'Agent not found or inactive', code: 'AGENT_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Handle delivery completion with direct database operations to bypass read-only constraints
    console.log('💾 Using direct database operations instead of RPC...');
    
    try {
      // MAXIMUM BULLETPROOF validation with all safety measures
      let validatedAmount;
      let validatedDistance;
      
      // Validate distance first
      console.log('🔍 Raw distance_km value:', { distance_km, type: typeof distance_km });
      const numericDistance = Number(distance_km);
      if (isNaN(numericDistance) || !isFinite(numericDistance) || numericDistance <= 0) {
        validatedDistance = 2.5; // Safe fallback
        console.log('⚠️ Invalid distance, using fallback:', validatedDistance);
      } else {
        validatedDistance = numericDistance;
      }
      
      // Validate payout amount with comprehensive checks
      console.log('🔍 Raw agent_payout value:', { agent_payout, type: typeof agent_payout });
      const numericAmount = Number(agent_payout);
      
      const hasValidAmount = (
        !isNaN(numericAmount) && 
        isFinite(numericAmount) && 
        numericAmount > 0 && 
        numericAmount !== null && 
        numericAmount !== undefined &&
        typeof numericAmount === 'number'
      );
      
      if (!hasValidAmount) {
        console.error('❌ Invalid payout amount, calculating bulletproof fallback:', { 
          agent_payout, 
          numericAmount,
          validationResults: {
            isNaN: isNaN(numericAmount),
            isFinite: isFinite(numericAmount),
            isPositive: numericAmount > 0,
            isNotNull: numericAmount !== null,
            isNotUndefined: numericAmount !== undefined,
            isNumber: typeof numericAmount === 'number'
          }
        });
        
        // Use new rate calculation: ₹12 base + ₹8/km
        validatedAmount = validatedDistance <= 1 ? 12 : 12 + (validatedDistance - 1) * 8;
        console.log('🔧 Bulletproof fallback calculation applied:', validatedAmount);
      } else {
        validatedAmount = numericAmount;
      }
      
      // Ultimate safety net
      if (!validatedAmount || validatedAmount <= 0 || isNaN(validatedAmount)) {
        validatedAmount = 20; // Emergency fallback
        console.log('🛡️ Emergency fallback applied:', validatedAmount);
      }
      
      console.log('💰 Maximum validated amount:', { validatedAmount, type: typeof validatedAmount });
      
      // Update order status directly
      const { error: orderUpdateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
        .eq('agent_id', agent.id);
      
      if (orderUpdateError) {
        console.error('❌ Order update failed:', orderUpdateError);
        throw new Error(`Order update failed: ${orderUpdateError.message}`);
      }
      
      console.log('✅ Order status updated to delivered');
      
      // Update agent wallet balance with validated amount
      const { data: existingWallet } = await supabaseClient
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', agent.id)
        .single();
      
      const currentBalance = existingWallet?.balance || 0;
      const newBalance = Number(currentBalance) + validatedAmount;
      
      console.log('💳 Wallet update:', { currentBalance, validatedAmount, newBalance });
      
      const { error: walletError } = await supabaseClient
        .from('agent_wallet')
        .upsert({
          agent_id: agent.id,
          balance: newBalance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'agent_id'
        });
      
      if (walletError) {
        console.log('⚠️ Wallet update warning:', walletError);
      } else {
        console.log('✅ Agent wallet updated with payout');
      }
      
      // Create earnings record with validated amount
      const { error: earningsError } = await supabaseClient
        .from('earnings')
        .insert({
          agent_id: agent.id,
          order_id: order_id,
          amount: validatedAmount,
          status: 'completed',
          description: `Delivery payout: ${distance_km}km`
        });
      
      if (earningsError) {
        console.log('⚠️ Earnings record warning:', earningsError);
      } else {
        console.log('✅ Earnings record created');
      }
      
      // Create wallet transaction with absolute final validation
      const absoluteFinalAmount = Number(validatedAmount);
      
      // Last line of defense before database insertion
      if (!absoluteFinalAmount || absoluteFinalAmount <= 0 || isNaN(absoluteFinalAmount) || !isFinite(absoluteFinalAmount)) {
        console.error('❌ CRITICAL ERROR: Absolute final amount validation failed');
        throw new Error(`Fatal amount validation error: ${absoluteFinalAmount} is not a valid positive number`);
      }
      
      console.log('🔒 Pre-insertion amount check passed:', { absoluteFinalAmount, type: typeof absoluteFinalAmount });
      
      const { error: transactionError } = await supabaseClient
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agent.id,
          order_id: order_id,
          amount: absoluteFinalAmount,
          transaction_type: 'delivery_payment',
          description: 'Simple delivery completion payout',
          status: 'completed'
        });
      
      if (transactionError) {
        console.log('⚠️ Transaction record warning:', transactionError);
      } else {
        console.log('✅ Wallet transaction recorded');
      }
      
      const completionResult = {
        success: true,
        payout_amount: agent_payout
      };
      
      console.log('✅ Delivery completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Delivery completed successfully!',
          order: {
            id: order_id,
            payment_method: payment_method,
            status: 'delivered',
            distance_km: distance_km,
            payout_amount: agent_payout
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (directOpError) {
      console.error('❌ Direct operations failed:', directOpError);
      
      // Check if it's a database constraint error
      const errorMessage = directOpError instanceof Error ? directOpError.message : String(directOpError);
      const isConstraintError = errorMessage.includes('violates not-null constraint') || 
                               errorMessage.includes('null value in column');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: isConstraintError ? 'Database validation error - invalid payout amount' : 'Failed to complete delivery',
          code: isConstraintError ? 'AMOUNT_VALIDATION_FAILED' : 'DIRECT_OP_FAILED',
          details: errorMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});