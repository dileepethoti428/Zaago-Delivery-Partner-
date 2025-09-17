import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two points
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate distance using Mapbox or fallback to Haversine
async function calculateDistance(origin: {lat: number, lng: number}, destination: {lat: number, lng: number}): Promise<number> {
  const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
  
  if (mapboxToken) {
    try {
      // Try Mapbox Directions API first
      const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${mapboxToken}&geometries=geojson`;
      
      const mapboxResponse = await fetch(mapboxUrl);
      const mapboxData = await mapboxResponse.json();
      
      if (mapboxData.routes && mapboxData.routes.length > 0) {
        const route = mapboxData.routes[0];
        return route.distance / 1000; // Convert meters to km
      } else {
        throw new Error('No routes found from Mapbox');
      }
    } catch (mapboxError) {
      console.log('Mapbox failed, using fallback for distance calculation:', mapboxError.message);
      return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    }
  } else {
    console.log('No Mapbox token, using Haversine fallback for distance calculation');
    return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  }
}

// Calculate agent payout based on distance
function calculateAgentPayout(distance: number): number {
  const basePay = 20; // Base pay for first 1 km
  const additionalDistance = Math.max(0, distance - 1); // Distance beyond 1 km
  const perKmRate = 15; // Rate per km for additional distance
  const distancePay = additionalDistance * perKmRate;
  
  return Math.round((basePay + distancePay) * 100) / 100; // Round to 2 decimal places
}

serve(async (req) => {
  console.log('Calculate delivery pricing function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { order_id, agent_location } = await req.json();
    console.log('Calculating pricing for order:', order_id);

    if (!order_id) {
      console.error('Missing order_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_id' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Failed to fetch order:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    let distance_km = 0;
    
    // If agent location is provided, calculate fresh distance
    if (agent_location && agent_location.lat && agent_location.lng) {
      if (order.address && order.address.coordinates && order.address.coordinates.lat && order.address.coordinates.lng) {
        try {
          distance_km = await calculateDistance(
            { lat: agent_location.lat, lng: agent_location.lng },
            { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
          );
          console.log(`Fresh distance calculated: ${distance_km.toFixed(2)}km`);
        } catch (distanceError) {
          console.warn('Failed to calculate fresh distance:', distanceError);
          // Fallback to stored distance or default
          distance_km = order.distance_km || 2.5;
        }
      } else {
        distance_km = order.distance_km || 2.5;
      }
    } else {
      // Use stored distance from order
      distance_km = order.distance_km || 2.5;
    }

    // Calculate pricing
    const agentPayout = calculateAgentPayout(distance_km);
    const estimatedTime = Math.ceil(distance_km * 2); // 2 minutes per km

    const result = {
      success: true,
      order_id: order_id,
      distance_km: Math.round(distance_km * 10) / 10, // Round to 1 decimal
      agent_payout: agentPayout,
      estimated_time_minutes: estimatedTime,
      breakdown: {
        base_pay: 20,
        additional_distance: Math.max(0, distance_km - 1),
        per_km_rate: 15,
        distance_pay: Math.max(0, (distance_km - 1) * 15)
      }
    };

    console.log('Pricing calculated:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error in calculate-delivery-pricing:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});