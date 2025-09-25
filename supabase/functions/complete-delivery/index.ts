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
    // Parse request body
    let body;
    try {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      body = JSON.parse(rawBody);
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format. Please ensure request body is valid JSON.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id, agent_location } = body;
    let { payment_method } = body;
    
    // Validate payment method
    if (!payment_method || typeof payment_method !== 'string') {
      payment_method = 'Online';
    } else {
      payment_method = payment_method.toString().trim();
    }
    
    const validPaymentMethods = ['Online', 'COD', 'UPI', 'Card'];
    if (!validPaymentMethods.includes(payment_method)) {
      payment_method = 'Online';
    }

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

    // Calculate distance for payout
    let distance_km = 2.5; // Default fallback
    let payout_amount = 35; // Default fallback
    
    if (order.address?.coordinates && order.pickup_location) {
      try {
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: order.pickup_location,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km = distanceData.distance_km;
          // Calculate payout: ₹20 base + ₹12/km beyond 1km
          payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 12;
        }
      } catch (distanceError) {
        console.warn('Distance calculation failed, using defaults:', distanceError);
      }
    }

    // Update order status to delivered
    const updateData = {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online'
    };
    
    try {
      const { error: updateError } = await supabaseClient
        .from('orders')
        .update(updateData)
        .eq('id', order_id);

      if (updateError) {
        console.error('Failed to update order:', updateError);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update order status', 
            details: updateError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database operation failed', 
          details: dbError instanceof Error ? dbError.message : String(dbError)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // For COD orders, automatically settle the amount
    let codSettlementResult = null;
    if (payment_method === 'COD') {
      try {
        const { data: settlementData, error: settlementError } = await supabaseClient.rpc('settle_cod_automatically', {
          p_agent_id: agent.id,
          p_order_id: order_id,
          p_cod_amount: order.total
        });

        if (settlementError) {
          console.warn('COD settlement error:', settlementError);
        } else {
          codSettlementResult = settlementData;
        }
      } catch (error) {
        console.warn('COD settlement failed:', error);
      }
    }

    // Process payout safely
    let payoutResult = null;
    try {
      const { data: payoutData, error: payoutError } = await supabaseClient.rpc('process_delivery_payout_safe', {
        p_agent_id: agent.id,
        p_order_id: order_id,
        p_distance_km: distance_km,
        p_delivery_time: new Date().toISOString()
      });

      if (payoutError) {
        console.warn('Payout processing error:', payoutError);
      } else {
        payoutResult = payoutData;
        if (payoutResult?.payout_details?.total_payout) {
          payout_amount = payoutResult.payout_details.total_payout;
        }
      }
    } catch (error) {
      console.warn('Payout processing failed:', error);
    }

    // Update delivery history with details
    try {
      const { error: historyUpdateError } = await supabaseClient
        .from('delivery_history')
        .update({
          delivery_notes: `Completed by ${agent.name}. Distance: ${distance_km.toFixed(2)}km`,
          distance_traveled: distance_km,
          delivery_payout: payout_amount,
          agent_location: agent_location
        })
        .eq('order_id', order_id);

      if (historyUpdateError) {
        console.warn('Could not update delivery history details:', historyUpdateError);
      }
    } catch (historyError) {
      console.warn('Delivery history update failed:', historyError);
    }

    // Check if earnings already exist to prevent duplicates
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
            status: 'completed',
            distance_km: distance_km,
            payment_method: payment_method === 'COD' ? 'COD' : 'Online',
            description: `Delivery payout for order ${order_id.substring(0, 8)}`
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
          location: order.address?.coordinates || null,
          notes: `Order delivered by ${agent.name}`
        });
    } catch (trackingError) {
      console.warn('Order tracking creation failed:', trackingError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          distance_km: Math.round(distance_km * 100) / 100,
          payout_amount: Math.round(payout_amount),
          payment_method
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete Delivery Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});