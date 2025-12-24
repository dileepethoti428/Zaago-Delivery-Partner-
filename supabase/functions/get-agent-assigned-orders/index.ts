import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the agent ID from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching assigned orders for user:', user.id);

    // Get the delivery agent's internal ID
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .single();

    if (agentError || !agent) {
      console.error('Agent not found:', agentError?.message);
      return new Response(
        JSON.stringify({ error: 'Agent not found', orders: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Agent internal ID:', agent.id);

    // Fetch ALL assigned orders from daily_orders without date filtering
    const { data: dailyOrders, error: ordersError } = await supabase
      .from('daily_orders')
      .select(`
        id,
        date,
        quantity,
        status,
        subscription_id,
        customer_id,
        location_id,
        created_at,
        subscriptions (
          id,
          delivery_address,
          delivery_time_slot,
          delivery_latitude,
          delivery_longitude,
          product_id,
          products (
            id,
            name,
            price,
            image_url
          )
        ),
        customers (
          id,
          full_name,
          phone,
          address,
          city,
          pincode,
          latitude,
          longitude
        )
      `)
      .eq('assigned_agent_id', agent.id)
      .in('status', ['pending', 'assigned'])
      .order('date', { ascending: true });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError.message);
      return new Response(
        JSON.stringify({ error: ordersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dailyOrders?.length || 0} assigned orders`);

    // Transform the data for the frontend
    const transformedOrders = (dailyOrders || []).map(order => {
      const subscription = order.subscriptions;
      const customer = order.customers;
      const product = subscription?.products;

      return {
        id: order.id,
        date: order.date,
        quantity: order.quantity,
        status: order.status,
        subscriptionId: order.subscription_id,
        customerId: order.customer_id,
        locationId: order.location_id,
        createdAt: order.created_at,
        // Customer details
        customerName: customer?.full_name || 'Unknown Customer',
        customerPhone: customer?.phone || null,
        customerAddress: customer?.address || null,
        customerCity: customer?.city || null,
        customerPincode: customer?.pincode || null,
        customerLatitude: customer?.latitude || null,
        customerLongitude: customer?.longitude || null,
        // Subscription delivery details (override customer if present)
        deliveryAddress: subscription?.delivery_address || customer?.address || null,
        deliveryTimeSlot: subscription?.delivery_time_slot || null,
        deliveryLatitude: subscription?.delivery_latitude || customer?.latitude || null,
        deliveryLongitude: subscription?.delivery_longitude || customer?.longitude || null,
        // Product details
        productId: product?.id || null,
        productName: product?.name || 'Unknown Product',
        productPrice: product?.price || 0,
        productImage: product?.image_url || null,
        // Flags
        isSubscription: !!order.subscription_id,
      };
    });

    return new Response(
      JSON.stringify({ orders: transformedOrders }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
