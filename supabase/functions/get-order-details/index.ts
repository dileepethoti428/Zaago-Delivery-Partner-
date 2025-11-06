import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Get order details function started")

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order details with delivery address
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        delivery_addresses (
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
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Format the response
    const response = {
      success: true,
      order: {
        id: orderData.id,
        status: orderData.status,
        payment_method: orderData.payment_method,
        payment_status: orderData.payment_status,
        total_amount: orderData.total_amount,
        delivery_charge: orderData.delivery_charge,
        items: orderData.items,
        special_instructions: orderData.special_instructions,
        delivery_otp: orderData.delivery_otp,
        otp_expiry: orderData.otp_expiry,
        created_at: orderData.created_at,
        accepted_at: orderData.accepted_at,
        delivered_at: orderData.delivered_at,
        
        // Customer details
        customer: {
          name: orderData.customer_name || orderData.delivery_addresses?.user_name,
          phone: orderData.customer_phone || orderData.delivery_addresses?.phone,
          address: orderData.delivery_addresses?.full_address,
          city: orderData.delivery_addresses?.city,
          state: orderData.delivery_addresses?.state,
          pincode: orderData.delivery_addresses?.pincode,
          landmark: orderData.delivery_addresses?.landmark,
          coordinates: orderData.delivery_addresses?.coordinates
        },
        
        // Seller/Pickup details
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

  } catch (error) {
    console.error('Error in get-order-details function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
