import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Simple complete delivery request started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_id, payment_method = 'Online', distance_km = 2.5, agent_payout = 35 } = body;
    
    console.log('📋 Request parameters:', { order_id, payment_method, distance_km, agent_payout });
    
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

    // Simple authentication check
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
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
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
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Agent found:', { id: agent.id, name: agent.name });

    // Get the order first to check it exists and belongs to this agent
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, customer_name, total, agent_id')
      .eq('id', order_id)
      .eq('agent_id', agent.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found or not assigned to this agent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Order found:', { id: order.id, status: order.status, customer: order.customer_name });

    // ROBUST UPDATE APPROACH - Multiple strategies for maximum reliability
    const payment_status = payment_method.toUpperCase() === 'COD' ? 'paid_cod' : 'paid_online';
    const now = new Date().toISOString();
    
    console.log('💾 Using ultra-robust delivery completion function...');
    console.log('🔍 Parameters:', { 
      order_id: order_id, 
      order_id_type: typeof order_id,
      agent_id: agent.id, 
      agent_id_type: typeof agent.id,
      payment_status 
    });
    
    // Ensure UUIDs are properly formatted strings
    const orderIdStr = String(order_id).trim();
    const agentIdStr = String(agent.id).trim();
    
    console.log('🔍 Converted parameters:', { orderIdStr, agentIdStr, payment_status });
    
    // Try the new ultra-robust stored procedure first
    const { data: procedureResult, error: procedureError } = await supabaseClient.rpc('direct_complete_delivery', {
      p_order_id: orderIdStr,
      p_new_status: 'delivered',
      p_new_payment_status: payment_status,
      p_agent_id: agentIdStr
    });
        
    if (procedureError) {
      console.error('❌ Primary stored procedure failed:', procedureError);
      
      // Fallback: Direct table update
      console.log('🔄 Attempting fallback direct update...');
      const { error: directUpdateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'delivered',
          payment_status: payment_status,
          delivered_at: now,
          updated_at: now
        })
        .eq('id', orderIdStr)
        .eq('agent_id', agentIdStr);
      
      if (directUpdateError) {
        console.error('❌ Fallback update also failed:', directUpdateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'All delivery completion methods failed',
            details: `Primary: ${procedureError.message}, Fallback: ${directUpdateError.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log('✅ Fallback update succeeded');
    } else if (procedureResult && !procedureResult.success) {
      console.error('❌ Stored procedure returned error:', procedureResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order completion failed',
          details: procedureResult.error
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    } else {
      console.log('✅ Primary stored procedure succeeded');
    }

    // Initialize variables for distance and payout calculation
    let finalDistance = distance_km;
    let finalPayout = agent_payout;

    // Create earnings record with real-time distance and payout data
    try {
      // If frontend passed 0 distance, calculate it on backend
      if (distance_km === 0) {
        console.log('⚠️ Frontend passed 0 distance, calculating on backend...');
        
        // Get pickup and delivery coordinates from order
        const { data: orderData, error: orderLookupError } = await supabaseClient
          .from('orders')
          .select('pickup_location, address')
          .eq('id', order_id)
          .single();
        
        if (!orderLookupError && orderData?.pickup_location && orderData?.address?.coordinates) {
          try {
            // Calculate distance using Mapbox or similar service
            const { data: distanceData, error: distanceError } = await supabaseClient.functions.invoke('calculate-distance-eta', {
              body: {
                pickup: orderData.pickup_location,
                delivery: orderData.address.coordinates
              }
            });
            
            if (!distanceError && distanceData?.distance_km) {
              finalDistance = Math.max(distanceData.distance_km, 1.0); // Minimum 1km
              // Recalculate payout: ₹12 base + ₹8 per km after first km
              finalPayout = finalDistance <= 1 ? 12 : Math.round(12 + (finalDistance - 1) * 8);
              console.log('✅ Backend calculated distance:', finalDistance, 'km, Payout:', finalPayout);
            }
          } catch (calcError) {
            console.warn('⚠️ Backend distance calculation failed:', calcError);
            finalDistance = 1.0; // Minimum fallback
            finalPayout = 12; // Base payout
          }
        } else {
          console.warn('⚠️ No valid coordinates for backend calculation, using minimums');
          finalDistance = 1.0; // Minimum fallback  
          finalPayout = 12; // Base payout
        }
      }
      
      console.log('💰 Creating earnings record with final data:', { 
        agent_payout: finalPayout, 
        distance_km: finalDistance, 
        payment_method 
      });
      
      const { error: earningsError } = await supabaseClient
        .from('earnings')
        .upsert({
          agent_id: agent.id,
          order_id: order_id,
          amount: finalPayout, // Use calculated payout
          status: 'completed',
          distance_km: finalDistance, // Use calculated distance
          payment_method: payment_method === 'COD' ? 'COD' : 'Online',
          description: `Delivery completion: ${finalDistance}km distance, ₹${finalPayout} payout`
        }, {
          onConflict: 'agent_id,order_id',
          ignoreDuplicates: true
        });
      
      if (!earningsError) {
        console.log('✅ Earnings record created/updated with accurate data');
      }
      
      // Also update delivery_history with accurate distance
      const { error: historyError } = await supabaseClient
        .from('delivery_history')
        .update({
          distance_traveled: finalDistance,
          delivery_payout: finalPayout,
          updated_at: now
        })
        .eq('order_id', order_id)
        .eq('agent_id', agent.id);
      
      if (!historyError) {
        console.log('✅ Delivery history updated with accurate distance');
      } else {
        console.warn('⚠️ Failed to update delivery history distance:', historyError);
      }
    } catch (error) {
      console.warn('⚠️ Earnings/History update failed (continuing anyway):', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          status: 'delivered',
          distance_km: finalDistance, // Use final calculated distance
          payout_amount: finalPayout // Use final calculated payout
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Simple Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});