import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

console.log("Get order details function started")

// Soft fail helper - returns 200 with success: false to avoid React crash
const softFailResponse = (reason: string) => {
  console.log('Soft fail:', reason);
  return new Response(
    JSON.stringify({ success: false, error: reason }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Looking up order_id:', order_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // STEP 1: Try to get order from orders table first
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        delivery_addresses:delivery_address_id (
          id,
          full_address,
          city,
          state,
          pincode,
          landmark,
          user_name,
          phone,
          coordinates
        )
      `)
      .eq('id', order_id)
      .maybeSingle();

    // If found in orders table, return it
    if (orderData && !orderError) {
      console.log('Found order in orders table:', orderData.id);
      
      // Parse address JSON fallback if delivery_addresses is null
      const addressJson = orderData.address ? (typeof orderData.address === 'string' ? JSON.parse(orderData.address) : orderData.address) : null;
      const deliveryAddr = orderData.delivery_addresses;

      const response = {
        success: true,
        order: {
          id: orderData.id,
          status: orderData.status,
          payment_method: orderData.payment_method,
          payment_status: orderData.payment_status,
          total_amount: orderData.total || 0,
          delivery_charge: orderData.delivery_charge,
          items: orderData.items,
          special_instructions: orderData.special_instructions,
          delivery_otp: orderData.delivery_otp,
          otp_expiry: orderData.otp_expiry,
          subscription_id: orderData.subscription_id,
          created_at: orderData.created_at,
          accepted_at: orderData.accepted_at,
          delivered_at: orderData.delivered_at,
          
          customer: {
            name: orderData.customer_name || deliveryAddr?.user_name || addressJson?.name || null,
            phone: orderData.customer_phone || deliveryAddr?.phone || addressJson?.phone || null,
            address: deliveryAddr?.full_address || addressJson?.full_address || addressJson?.address || null,
            city: deliveryAddr?.city || addressJson?.city || null,
            state: deliveryAddr?.state || addressJson?.state || null,
            pincode: deliveryAddr?.pincode || addressJson?.pincode || null,
            landmark: deliveryAddr?.landmark || addressJson?.landmark || null,
            coordinates: deliveryAddr?.coordinates || addressJson?.coordinates || null
          },
          
          seller: {
            name: orderData.seller_name,
            phone: orderData.seller_phone,
            address: orderData.pickup_address,
            coordinates: orderData.pickup_location
          }
        }
      };

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Not found in orders, try daily_orders table (subscription orders)
    console.log('Order not found in orders table, trying daily_orders...');
    
    const { data: dailyOrder, error: dailyError } = await supabase
      .from('daily_orders')
      .select(`
        id,
        date,
        quantity,
        status,
        created_at,
        subscription_id,
        customer_id,
        subscriptions (
          id,
          quantity,
          price_per_unit,
          delivery_address,
          customers (
            id,
            full_name,
            phone,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude
          ),
          products (
            id,
            name,
            price,
            seller_id,
            sellers (
              id,
              business_name,
              phone,
              address,
              latitude,
              longitude
            )
          )
        )
      `)
      .eq('id', order_id)
      .maybeSingle();

    if (dailyError) {
      console.error('Error fetching daily order:', dailyError);
    }

    if (!dailyOrder) {
      console.log('Order not found in daily_orders either');
      return softFailResponse('Order not found');
    }

    console.log('Found daily order:', dailyOrder.id);

    // Format response from daily_order + subscription data
    const sub = dailyOrder.subscriptions;
    const customer = sub?.customers;
    const product = sub?.products;
    const seller = product?.sellers;
    const deliveryAddress = sub?.delivery_address;

    // Parse delivery_address if it's JSON
    let parsedDeliveryAddress = null;
    if (deliveryAddress) {
      try {
        parsedDeliveryAddress = typeof deliveryAddress === 'string' 
          ? JSON.parse(deliveryAddress) 
          : deliveryAddress;
      } catch (e) {
        console.log('Could not parse delivery_address:', e);
      }
    }

    // Calculate total amount
    const pricePerUnit = sub?.price_per_unit || product?.price || 0;
    const quantity = dailyOrder.quantity || sub?.quantity || 1;
    const totalAmount = pricePerUnit * quantity;

    const response = {
      success: true,
      order: {
        id: dailyOrder.id,
        status: dailyOrder.status || 'pending',
        payment_method: 'subscription',
        payment_status: 'prepaid',
        total_amount: totalAmount,
        delivery_charge: 0,
        items: [{
          name: product?.name || 'Subscription Item',
          quantity: quantity,
          price: pricePerUnit,
          total: totalAmount
        }],
        special_instructions: null,
        delivery_otp: null,
        otp_expiry: null,
        subscription_id: dailyOrder.subscription_id,
        created_at: dailyOrder.created_at,
        accepted_at: null,
        delivered_at: dailyOrder.status === 'delivered' ? dailyOrder.created_at : null,
        
        customer: {
          name: customer?.full_name || parsedDeliveryAddress?.name || null,
          phone: customer?.phone || parsedDeliveryAddress?.phone || null,
          address: parsedDeliveryAddress?.full_address || customer?.address || null,
          city: parsedDeliveryAddress?.city || customer?.city || null,
          state: parsedDeliveryAddress?.state || customer?.state || null,
          pincode: parsedDeliveryAddress?.pincode || customer?.pincode || null,
          landmark: parsedDeliveryAddress?.landmark || null,
          coordinates: parsedDeliveryAddress?.coordinates || 
            (customer?.latitude && customer?.longitude 
              ? { lat: customer.latitude, lng: customer.longitude } 
              : null)
        },
        
        seller: {
          name: seller?.business_name || 'Seller',
          phone: seller?.phone || null,
          address: seller?.address || null,
          coordinates: seller?.latitude && seller?.longitude 
            ? { lat: seller.latitude, lng: seller.longitude } 
            : null
        }
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-order-details function:', error);
    return softFailResponse('Internal server error');
  }
})
