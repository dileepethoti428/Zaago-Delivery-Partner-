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

    // VALIDATE: Agent exists and is active
    const { data: agentData, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, is_active')
      .eq('agent_id', agent_id) // Query by auth user ID
      .single();

    if (agentError || !agentData) {
      console.error('❌ Agent not found:', agent_id, agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or invalid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!agentData.is_active) {
      console.error('❌ Agent is not active:', agent_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent is not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log(`✅ Agent ${agent_id} validated successfully`);

    // ATOMIC CHECK: Verify order is still available before accepting
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items
      `)
      .eq('id', order_id)
      .is('agent_id', null) // Only orders without an agent
      .in('status', ['accepted']) // Acceptable pre-assignment status
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order:', orderError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: orderData ? 'Order already assigned or delivered' : 'Order not found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    console.log(`✅ Order ${order_id} is available for acceptance by agent ${agent_id}`);

    // Get payout configuration for earnings calculation
    const { data: payoutConfig } = await supabase
      .from('payout_config')
      .select('*')
      .eq('is_active', true)
      .single();

    const basePay = payoutConfig?.base_pay_amount || 40;
    const baseDistanceKm = payoutConfig?.base_pay_distance_km || 3;
    const perKmRate = payoutConfig?.per_km_max_rate || 9;
    
    // Check if peak hour
    const currentTime = new Date().toTimeString().substring(0, 5);
    const peakStart = payoutConfig?.peak_hour_start || '06:00';
    const peakEnd = payoutConfig?.peak_hour_end || '12:00';
    const isPeakHour = currentTime >= peakStart && currentTime <= peakEnd;

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

    // Calculate expected payout (estimated distance: 5km for now, will be updated on completion)
    const estimatedDistance = 5; // Default estimate
    const distancePay = estimatedDistance > baseDistanceKm ? 
      (estimatedDistance - baseDistanceKm) * perKmRate : 0;
    
    const subtotal = basePay + distancePay;
    const surgeAmount = isPeakHour ? subtotal * 0.15 : 0;
    const platformFee = 13;
    const expectedPayout = subtotal + surgeAmount - platformFee;
    
    const acceptedAt = new Date().toISOString();

    // Update order status to assigned and save pickup location data
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'assigned',
        agent_id: agentData.id, // Use delivery agent's primary key
        accepted_at: acceptedAt,
        pickup_location: pickupLocation,
        pickup_address: pickupAddress,
        seller_name: sellerName,
        seller_phone: sellerPhone,
        updated_at: acceptedAt
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
    
    // Create earnings tracking record
    const { error: trackingError } = await supabase
      .from('agent_earnings_tracking')
      .insert({
        agent_id: agentData.id, // Use delivery agent's primary key
        order_id: order_id,
        accepted_at: acceptedAt,
        expected_payout: expectedPayout,
        payout_status: 'pending',
        distance_km: estimatedDistance,
        is_peak_hour: isPeakHour,
        payout_breakdown: {
          base_pay: basePay,
          distance_pay: distancePay,
          peak_bonus: surgeAmount,
          platform_fee: platformFee
        }
      });

    if (trackingError) {
      console.error('❌ Failed to create earnings tracking:', trackingError);
      // Don't fail the order acceptance, just log
    } else {
      console.log(`✅ Earnings tracking created: ₹${expectedPayout} expected payout`);
    }
    
    // Generate OTP for delivery verification
    try {
      const { data: otpData, error: otpError } = await supabase.functions.invoke('generate-delivery-otp', {
        body: { order_id }
      });
      
      if (otpError) {
        console.error('Error generating OTP:', otpError);
      } else {
        console.log(`✅ OTP generated for order ${order_id}:`, otpData);
      }
    } catch (otpErr) {
      console.error('Failed to generate OTP:', otpErr);
      // Don't fail the order acceptance if OTP generation fails
    }
    
    // BROADCAST ORDER ASSIGNMENT to all agents via real-time
    // This immediately notifies other agents to stop showing this order
    const channel = supabase.channel('orders-realtime-updates')
    
    await channel.send({
      type: 'broadcast',
      event: 'order_assigned',
      payload: {
        type: 'order_assigned',
        order_id: order_id,
        agent_id: agent_id,
        timestamp: new Date().toISOString(),
        message: 'Order has been accepted by another agent'
      }
    })
    
    console.log(`📡 Broadcast sent - order_assigned event for order ${order_id}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Order accepted successfully',
        pickup_location: pickupLocation,
        pickup_address: pickupAddress
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in accept-order function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})