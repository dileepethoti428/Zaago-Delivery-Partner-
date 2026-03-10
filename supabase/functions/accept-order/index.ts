import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Zepto/Blinkit style pricing for regular orders
const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
};

/**
 * Calculate road distance between seller and customer using Google Distance Matrix API
 * This is the CORRECT distance for payout calculation (not agent location)
 */
async function calculateRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> {
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  
  if (!googleApiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
    console.error('❌ Invalid coordinates:', { origin, destination });
    return null;
  }

  try {
    const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${googleApiKey}`;
    
    console.log(`📍 Calculating road distance: Seller(${origin.lat},${origin.lng}) → Customer(${destination.lat},${destination.lng})`);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const distanceMeters = data.rows[0].elements[0].distance.value;
      const distanceKm = distanceMeters / 1000;
      // Round UP to 1 decimal place (Zepto/Blinkit style)
      const roundedDistance = Math.ceil(distanceKm * 10) / 10;
      // Minimum 0.1km, maximum 25km
      const finalDistance = Math.max(0.1, Math.min(25, roundedDistance));
      
      console.log(`✅ Road distance calculated: ${finalDistance}km (raw: ${distanceKm.toFixed(2)}km)`);
      return finalDistance;
    } else {
      console.error('❌ Google Distance Matrix API returned invalid status:', data.status, data.rows?.[0]?.elements?.[0]?.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Google Distance Matrix API error:', error);
    return null;
  }
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
      .select('id, is_active, latitude, longitude')
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

    const acceptedAt = new Date().toISOString();

    // ============================================
    // IDEMPOTENCY CHECK: If agent already owns this order, return success
    // ============================================
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select('id, status, agent_id, assigned_agent_id, items, address')
      .eq('id', order_id)
      .single();

    if (checkError || !existingOrder) {
      console.error('❌ Order not found:', order_id, checkError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found', error_code: 'ORDER_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // If this agent already owns the order, return success (idempotent)
    if (existingOrder.agent_id === agentData.id || existingOrder.assigned_agent_id === agentData.id) {
      console.log(`✅ Order ${order_id} already assigned to this agent - returning success (idempotent)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          already_assigned: true,
          message: 'Order already assigned to you'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // ATOMIC UPDATE: Only first agent wins
    // This combines the check + update in ONE query
    // If agent_id is already set, 0 rows are updated
    // ============================================
    console.log(`📋 Attempting atomic update for order ${order_id}`, {
      current_status: existingOrder.status,
      current_agent_id: existingOrder.agent_id,
      current_assigned_agent_id: existingOrder.assigned_agent_id,
      new_agent_id: agentData.id
    });

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'assigned',
        agent_id: agentData.id,           // Set BOTH columns for consistency
        assigned_agent_id: agentData.id,  // Both columns point to same agent
        accepted_at: acceptedAt,
        updated_at: acceptedAt
      })
      .eq('id', order_id)
      .is('agent_id', null)               // Must be unassigned
      .is('assigned_agent_id', null)      // Must be unassigned
      .in('status', ['accepted', 'packed'])  // Only if still available
      .select(`*, items`)
      .maybeSingle();

    if (updateError) {
      console.error('❌ Database error updating order:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error while accepting order',
          error_code: 'DATABASE_ERROR'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // If no rows updated, order was already taken or status changed
    // Return 200 with success:false for race conditions (not a server error)
    if (!updatedOrder) {
      const reason = (existingOrder.agent_id || existingOrder.assigned_agent_id) 
        ? 'ORDER_ALREADY_ACCEPTED' 
        : 'ORDER_NOT_AVAILABLE';
      const message = reason === 'ORDER_ALREADY_ACCEPTED'
        ? 'This order has already been accepted by another agent'
        : `Order is no longer available (status: ${existingOrder.status})`;
      
      // Log as info, not error - this is a normal race condition
      console.log(`ℹ️ Order conflict for ${order_id}:`, {
        reason,
        order_id,
        current_status: existingOrder.status,
        current_agent_id: existingOrder.agent_id,
        current_assigned_agent_id: existingOrder.assigned_agent_id,
        requesting_agent_id: agentData.id
      });
      
      // Return 200 with success:false - prevents FunctionsHttpError on client
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: message,
          error_code: reason,
          current_status: existingOrder.status,
          current_agent_id: existingOrder.agent_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`✅ Order ${order_id} atomically accepted by agent ${agent_id}`);

    // Get seller information for pickup location (after successful acceptance)
    let pickupLocation = null;
    let pickupAddress = null;
    let sellerName = null;
    let sellerPhone = null;
    let calculatedDistance: number | null = null;

    if (updatedOrder.items && updatedOrder.items.length > 0) {
      const sellerId = updatedOrder.items[0].seller_id;
      
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
            
            if (normalizedAddress === 'Pickup Location' && sellerData.business_name) {
              normalizedAddress = sellerData.business_name;
            }
            
            pickupAddress = normalizedAddress;
            sellerName = sellerData.name || sellerData.business_name;
            sellerPhone = sellerData.phone;

            // ============================================
            // CALCULATE SELLER → CUSTOMER ROAD DISTANCE
            // This is the CORRECT distance for payout calculation
            // ============================================
            const customerCoords = updatedOrder.address?.coordinates;
            
            if (customerCoords?.lat && customerCoords?.lng) {
              console.log(`📍 Calculating distance: Seller(${sellerData.latitude},${sellerData.longitude}) → Customer(${customerCoords.lat},${customerCoords.lng})`);
              
              calculatedDistance = await calculateRoadDistance(
                { lat: sellerData.latitude, lng: sellerData.longitude },
                { lat: customerCoords.lat, lng: customerCoords.lng }
              );
              
              // Validation guard - prevent obviously wrong distances
              if (calculatedDistance !== null) {
                if (calculatedDistance < 0.1 || calculatedDistance > 25) {
                  console.warn(`⚠️ Distance out of expected range: ${calculatedDistance}km, using fallback`);
                  calculatedDistance = 2.5; // Reasonable fallback
                }
              } else {
                console.warn('⚠️ Could not calculate road distance, using fallback');
                calculatedDistance = 2.5; // Fallback if API fails
              }
              
              console.log(`✅ Final distance for payout: ${calculatedDistance}km`);
            } else {
              console.warn('⚠️ Customer coordinates not available in order.address');
              calculatedDistance = 2.5; // Fallback
            }
          }
        }
      }
    }

    // Use calculated distance or fallback
    const finalDistance = calculatedDistance ?? 2.5;
    
    // Recalculate expected payout with ACTUAL distance
    const distancePay = finalDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
    const expectedPayout = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
    
    console.log(`💰 Payout calculation: ₹${REGULAR_ORDER_PRICING.BASE_PAY} base + ₹${distancePay.toFixed(2)} distance (${finalDistance}km × ₹${REGULAR_ORDER_PRICING.DISTANCE_RATE}) = ₹${expectedPayout.toFixed(2)}`);

    // Update order with pickup details AND calculated distance
    const updateFields: Record<string, unknown> = {};
    if (pickupLocation) updateFields.pickup_location = pickupLocation;
    if (pickupAddress) updateFields.pickup_address = pickupAddress;
    if (sellerName) updateFields.seller_name = sellerName;
    if (sellerPhone) updateFields.seller_phone = sellerPhone;
    updateFields.distance_km = finalDistance; // Store calculated distance!
    
    if (Object.keys(updateFields).length > 0) {
      const { error: updateFieldsError } = await supabase
        .from('orders')
        .update(updateFields)
        .eq('id', order_id);
      
      if (updateFieldsError) {
        console.error('⚠️ Failed to update order fields:', updateFieldsError);
      } else {
        console.log(`✅ Order updated with distance_km: ${finalDistance}km`);
      }
    }

    console.log(`Order ${order_id} successfully accepted by agent ${agent_id}`);
    
    // Create earnings tracking record with ACTUAL calculated distance
    const { error: trackingError } = await supabase
      .from('agent_earnings_tracking')
      .insert({
        agent_id: agentData.id, // Use delivery agent's primary key
        order_id: order_id,
        accepted_at: acceptedAt,
        expected_payout: Math.round(expectedPayout * 10) / 10,
        payout_status: 'pending',
        distance_km: finalDistance, // Use calculated distance!
        is_peak_hour: false, // No peak hour pricing in new model
        payout_breakdown: {
          base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
          distance_pay: Math.round(distancePay * 10) / 10,
          distance_km: finalDistance,
          rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE,
          distance_source: 'google_distance_matrix'
        }
      });

    if (trackingError) {
      console.error('❌ Failed to create earnings tracking:', trackingError);
      // Don't fail the order acceptance, just log
    } else {
      console.log(`✅ Earnings tracking created: ₹${expectedPayout.toFixed(2)} expected payout (₹${REGULAR_ORDER_PRICING.BASE_PAY} base + ₹${distancePay.toFixed(2)} for ${finalDistance}km)`);
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