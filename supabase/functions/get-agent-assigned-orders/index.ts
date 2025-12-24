import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Soft-fail helper - returns 200 with success: false instead of 4xx
const softFailResponse = (reason: string) => {
  console.log('[DEBUG] Soft fail:', reason);
  return new Response(
    JSON.stringify({ success: false, reason, orders: [] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
      console.error('[DEBUG] No authorization header provided');
      return softFailResponse('No authorization header');
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[DEBUG] Auth error:', authError?.message);
      return softFailResponse('Invalid or expired token');
    }

    console.log('[DEBUG] Authenticated user.id:', user.id);

    // Get the delivery agent's internal ID
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .single();

    if (agentError || !agent) {
      console.error('[DEBUG] Agent not found for user.id:', user.id, 'Error:', agentError?.message);
      return new Response(
        JSON.stringify({ error: 'Agent not found', orders: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG] deliveryAgentInternalId:', agent.id);

    // SIMPLE QUERY: Fetch ALL assigned orders from daily_orders
    // NO date filters, NO subscription filters - just assigned_agent_id and status
    console.log('[DEBUG] Executing query: SELECT * FROM daily_orders WHERE assigned_agent_id =', agent.id, "AND status IN ('pending', 'assigned') ORDER BY date ASC");
    
    const { data: dailyOrders, error: ordersError } = await supabase
      .from('daily_orders')
      .select('*')
      .eq('assigned_agent_id', agent.id)
      .in('status', ['pending', 'assigned'])
      .order('date', { ascending: true });

    if (ordersError) {
      console.error('[DEBUG] Error fetching daily_orders:', ordersError.message);
      return new Response(
        JSON.stringify({ error: ordersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG] orders.length:', dailyOrders?.length || 0);
    console.log('[DEBUG] orders (raw):', JSON.stringify(dailyOrders, null, 2));

    // If no orders, return early
    if (!dailyOrders || dailyOrders.length === 0) {
      console.log('[DEBUG] No orders found, returning empty array');
      return new Response(
        JSON.stringify({ orders: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch related data separately to avoid join issues
    const subscriptionIds = [...new Set(dailyOrders.map(o => o.subscription_id).filter(Boolean))];
    const customerIds = [...new Set(dailyOrders.map(o => o.customer_id).filter(Boolean))];

    console.log('[DEBUG] Fetching subscriptions for IDs:', subscriptionIds);
    console.log('[DEBUG] Fetching customers for IDs:', customerIds);

    // Fetch subscriptions with products
    let subscriptionsMap: Record<string, any> = {};
    if (subscriptionIds.length > 0) {
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select(`
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
        `)
        .in('id', subscriptionIds);

      if (subError) {
        console.error('[DEBUG] Error fetching subscriptions:', subError.message);
      } else {
        console.log('[DEBUG] Fetched subscriptions:', subscriptions?.length || 0);
        subscriptions?.forEach(s => {
          subscriptionsMap[s.id] = s;
        });
      }
    }

    // Fetch customers
    let customersMap: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, full_name, phone, address, city, pincode, latitude, longitude')
        .in('id', customerIds);

      if (custError) {
        console.error('[DEBUG] Error fetching customers:', custError.message);
      } else {
        console.log('[DEBUG] Fetched customers:', customers?.length || 0);
        customers?.forEach(c => {
          customersMap[c.id] = c;
        });
      }
    }

    // Transform the data for the frontend
    const transformedOrders = dailyOrders.map(order => {
      const subscription = subscriptionsMap[order.subscription_id] || null;
      const customer = customersMap[order.customer_id] || null;
      const product = subscription?.products || null;

      const transformed = {
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

      console.log('[DEBUG] Transformed order:', order.id, '| date:', order.date, '| isSubscription:', !!order.subscription_id);
      return transformed;
    });

    console.log('[DEBUG] Returning', transformedOrders.length, 'transformed orders');

    return new Response(
      JSON.stringify({ orders: transformedOrders }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DEBUG] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
