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
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get agent info
    const { data: agent } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!agent) {
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

    // Calculate distance between agent and customer
    let distance_km = 2.0; // Default fallback
    let payout_amount = 35; // Base amount

    if (agent_location && order.address?.coordinates) {
      try {
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: agent_location,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km = distanceData.distance_km;
          
          // Calculate fair payout: ₹20 base + ₹15/km beyond 1km
          if (distance_km <= 1) {
            payout_amount = 20;
          } else {
            payout_amount = 20 + ((distance_km - 1) * 15);
          }
        }
      } catch (distanceError) {
        console.error('Distance calculation failed:', distanceError);
      }
    }

    // Update order status to delivered
    await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_method === 'COD' ? 'cash_collected' : 'prepaid'
      })
      .eq('id', order_id);

    // Create delivery history record
    await supabaseClient
      .from('delivery_history')
      .insert({
        order_id: order_id,
        agent_id: agent.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        delivery_address: order.address,
        items: order.items,
        total_amount: order.total,
        payment_method: payment_method,
        payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online',
        delivery_date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
        special_instructions: order.special_instructions,
        delivery_time_slot: order.delivery_time_slot,
        distance_traveled: distance_km,
        delivery_payout: payout_amount,
        agent_location: agent_location
      });

    // Create earnings record
    await supabaseClient
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

    // Update agent statistics
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

    // Create order tracking record
    await supabaseClient
      .from('order_tracking')
      .insert({
        order_id: order_id,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        location: agent_location || null,
        notes: `Order delivered by ${agent.name}. Distance: ${distance_km.toFixed(2)}km, Payout: ₹${payout_amount}`
      });

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