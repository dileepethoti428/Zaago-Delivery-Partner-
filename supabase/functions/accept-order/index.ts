import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Accept order function started")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, agent_id } = await req.json();

    if (!order_id || !agent_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_id or agent_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, get the order details with seller information
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items
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

    // Get seller information for pickup location
    let pickupLocation = null;
    let pickupAddress = null;
    let sellerName = null;
    let sellerPhone = null;

    if (orderData.items && orderData.items.length > 0) {
      const sellerId = orderData.items[0].seller_id;
      
      if (sellerId) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('sellers')
          .select('name, phone, latitude, longitude, address, business_name')
          .eq('user_id', sellerId)
          .single();

        if (sellerData && !sellerError) {
          if (sellerData.latitude && sellerData.longitude) {
            pickupLocation = {
              lat: sellerData.latitude,
              lng: sellerData.longitude
            };
            
            // Handle address field - it might be jsonb or string
            let normalizedAddress = 'Pickup Location';
            if (sellerData.address) {
              if (typeof sellerData.address === 'string') {
                normalizedAddress = sellerData.address;
              } else if (typeof sellerData.address === 'object') {
                // Handle jsonb address format
                if (sellerData.address.full_address) {
                  normalizedAddress = sellerData.address.full_address;
                } else if (sellerData.address.addressLine1) {
                  const parts = [
                    sellerData.address.addressLine1,
                    sellerData.address.addressLine2,
                    sellerData.address.city,
                    sellerData.address.state,
                    sellerData.address.pincode
                  ].filter(Boolean);
                  normalizedAddress = parts.join(', ');
                } else if (sellerData.address.city || sellerData.address.state) {
                  const parts = [
                    sellerData.address.city,
                    sellerData.address.state,
                    sellerData.address.pincode
                  ].filter(Boolean);
                  normalizedAddress = parts.join(', ');
                }
              }
            }
            
            // Fallback to business name if address is still generic
            if (normalizedAddress === 'Pickup Location' && sellerData.business_name) {
              normalizedAddress = sellerData.business_name;
            }
            
            pickupAddress = normalizedAddress;
            sellerName = sellerData.name || sellerData.business_name;
            sellerPhone = sellerData.phone;
          }
        }
      }
    }

    // Update order status to assigned and save pickup location data
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'assigned',
        agent_id: agent_id,
        pickup_location: pickupLocation,
        pickup_address: pickupAddress,
        seller_name: sellerName,
        seller_phone: sellerPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to accept order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Order ${order_id} successfully accepted by agent ${agent_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Order accepted successfully',
        pickup_location: pickupLocation,
        pickup_address: pickupAddress
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in accept-order function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})