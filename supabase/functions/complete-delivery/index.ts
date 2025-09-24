
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
    const { order_id, payment_method = 'Online', agent_location } = await req.json();

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
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if order is already delivered
    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance first (before any database operations)
    // Use shop location (Bangalore coordinates) to customer address for consistent delivery distance
    let distance_km = 2.0;
    let payout_amount = 35;

    if (order.address?.coordinates) {
      try {
        // Use shop coordinates (same as Home page for consistency)
        const shopLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore coordinates
        
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: shopLocation,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km = distanceData.distance_km;
          // Calculate payout based on real distance: ₹20 base + ₹15/km beyond 1km
          payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 15;
        }
      } catch (distanceError) {
        console.error('Distance calculation failed:', distanceError);
      }
    }

    // Check if delivery is late and send apology if needed
    const { data: orderData } = await supabaseClient
      .from('orders')
      .select('delivery_time_slot, delivery_date, customer_name, customer_phone, created_at')
      .eq('id', order_id)
      .single();

    let isLateDelivery = false;
    let delayMinutes = 0;

    if (orderData?.delivery_time_slot && orderData?.delivery_date) {
      // Parse scheduled delivery time
      const scheduledTime = new Date(`${orderData.delivery_date}T${orderData.delivery_time_slot.split('-')[1]}:00`);
      const currentTime = new Date();
      
      if (currentTime > scheduledTime) {
        isLateDelivery = true;
        delayMinutes = Math.floor((currentTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
      }
    } else if (orderData?.created_at) {
      // For immediate deliveries, check if more than 30 minutes have passed since order creation
      const orderTime = new Date(orderData.created_at);
      const currentTime = new Date();
      const minutesSinceOrder = Math.floor((currentTime.getTime() - orderTime.getTime()) / (1000 * 60));
      
      if (minutesSinceOrder > 30) {
        isLateDelivery = true;
        delayMinutes = minutesSinceOrder - 30; // Minutes beyond expected 30 min delivery
      }
    }

    // Update order status to delivered FIRST (main operation - must succeed)
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online'
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update order status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Send apology message if delivery is late
    if (isLateDelivery && orderData?.customer_phone && orderData?.customer_name && delayMinutes > 5) {
      try {
        const { error: apologyError } = await supabaseClient.functions.invoke('send-apology-message', {
          body: {
            order_id,
            customer_phone: orderData.customer_phone,
            customer_name: orderData.customer_name,
            delay_minutes: delayMinutes
          }
        });

        if (apologyError) {
          console.warn('Failed to send apology message:', apologyError);
        } else {
          console.log(`Apology message sent for late delivery: ${delayMinutes} minutes delay`);
        }
      } catch (apologyError) {
        console.warn('Error sending apology message:', apologyError);
      }
    }

    // For COD orders, automatically settle the amount from agent wallet to admin
    let codSettlementResult = null;
    if (payment_method === 'COD') {
      try {
        const { data: settlementData, error: settlementError } = await supabaseClient.rpc('settle_cod_automatically', {
          p_agent_id: agent.id,
          p_order_id: order_id,
          p_cod_amount: order.total
        });

        if (settlementError) {
          console.error('COD settlement error:', settlementError);
        } else {
          codSettlementResult = settlementData;
          console.log('COD settlement result:', settlementData);
        }
      } catch (error) {
        console.error('COD settlement failed:', error);
      }
    }

    // NOW process payout safely (after order is delivered)
    let payoutResult = null;
    try {
      const { data: payoutData, error: payoutError } = await supabaseClient.rpc('process_delivery_payout_safe', {
        p_agent_id: agent.id,
        p_order_id: order_id,
        p_distance_km: distance_km,
        p_delivery_time: new Date().toISOString()
      });

      if (payoutError) {
        console.error('Payout processing error:', payoutError);
      } else {
        payoutResult = payoutData;
        payout_amount = payoutResult?.payout_details?.total_payout || payout_amount;
        console.log('Payout processed:', payoutResult);
      }
    } catch (error) {
      console.error('Payout processing failed:', error);
    }

    // The trigger will handle delivery_history creation, but let's also try to update it with more details
    try {
      const { error: historyUpdateError } = await supabaseClient
        .from('delivery_history')
        .update({
          distance_traveled: distance_km,
          delivery_payout: payout_amount,
          agent_location: agent_location,
          delivery_notes: `Completed via manual delivery by ${agent.name}. Distance: ${distance_km.toFixed(2)}km${payoutResult ? ' - Payout: ₹' + payout_amount : ''}`
        })
        .eq('order_id', order_id);

      if (historyUpdateError) {
        console.warn('Could not update delivery history details:', historyUpdateError);
      }
    } catch (historyError) {
      console.warn('Delivery history update failed:', historyError);
    }

    // Check if earnings already exist to prevent duplicate constraint violations
    const { data: existingEarning } = await supabaseClient
      .from('earnings')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('order_id', order_id)
      .single();

    // Only create earnings if none exist and payout function didn't succeed
    if (!existingEarning && (!payoutResult || !payoutResult.success)) {
      try {
        const { error: earningsError } = await supabaseClient
          .from('earnings')
          .insert({
            agent_id: agent.id,
            order_id: order_id,
            amount: payout_amount,
            distance_km: distance_km,
            payment_method: payment_method,
            status: 'completed',
            description: `Delivery payout for order ${order_id.slice(0, 8)}`
          });

        if (earningsError) {
          console.warn('Failed to create earnings record:', earningsError);
        }
      } catch (earningsCreateError) {
        console.warn('Earnings creation failed:', earningsCreateError);
      }
    }

    // Update agent statistics
    try {
      const { data: currentAgent } = await supabaseClient
        .from('delivery_agents')
        .select('total_deliveries, deliveries_today, total_earnings')
        .eq('id', agent.id)
        .single();

      if (currentAgent) {
        await supabaseClient
          .from('delivery_agents')
          .update({
            total_deliveries: (currentAgent.total_deliveries || 0) + 1,
            deliveries_today: (currentAgent.deliveries_today || 0) + 1,
            total_earnings: (currentAgent.total_earnings || 0) + payout_amount,
            last_delivery_at: new Date().toISOString()
          })
          .eq('id', agent.id);
      }
    } catch (statsError) {
      console.warn('Agent stats update failed:', statsError);
    }

    // Create order tracking record
    try {
      await supabaseClient
        .from('order_tracking')
        .insert({
          order_id: order_id,
          status: 'delivered',
          timestamp: new Date().toISOString(),
          location: agent_location || null,
          notes: `Order delivered by ${agent.name}. Distance: ${distance_km.toFixed(2)}km, Payout: ₹${payout_amount}`
        });
    } catch (trackingError) {
      console.warn('Order tracking creation failed:', trackingError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          distance_km,
          payout_amount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete Delivery Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
