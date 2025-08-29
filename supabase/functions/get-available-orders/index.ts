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
      // Fall back to Haversine calculation
      return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    }
  } else {
    console.log('No Mapbox token, using Haversine fallback for distance calculation');
    // Use Haversine distance if no Mapbox token
    return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  }
}

serve(async (req) => {
  console.log('Get available orders function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { agent_id } = await req.json();
    console.log('Getting available orders for agent:', agent_id);

    if (!agent_id) {
      console.error('Missing agent_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing agent_id' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get agent's current location
    const { data: agentLocation, error: locationError } = await supabase
      .from('driver_locations')
      .select('latitude, longitude')
      .eq('agent_id', agent_id)
      .eq('is_active', true)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (locationError) {
      console.warn('Failed to get agent location:', locationError);
      // If no location found, return all orders (backward compatibility)
    }

    // Get available orders from individual users only (not restaurants)
    // Filter by user_role to exclude restaurant/business sellers
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        user_profile:profiles!inner(user_id, full_name),
        user_roles:user_roles!inner(user_id, role)
      `)
      .in('status', ['placed', 'assigned'])
      .neq('status', 'delivered')
      .eq('user_roles.role', 'user');

    if (error) {
      console.error('Failed to fetch orders:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch orders' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Get excluded order IDs for this agent
    const { data: exclusions, error: exclusionError } = await supabase
      .from('order_exclusions')
      .select('order_id')
      .eq('agent_id', agent_id);

    if (exclusionError) {
      console.warn('Failed to fetch exclusions:', exclusionError);
    }

    // Filter out excluded orders
    const excludedOrderIds = exclusions?.map(ex => ex.order_id) || [];
    let filteredOrders = orders?.filter(order => !excludedOrderIds.includes(order.id)) || [];

    // Apply 15km radius filtering if agent location is available
    if (agentLocation && agentLocation.latitude && agentLocation.longitude) {
      console.log('Applying 15km radius filter for agent location:', {
        lat: agentLocation.latitude,
        lng: agentLocation.longitude
      });

      const nearbyOrders = [];
      
      for (const order of filteredOrders) {
        // Check if order has address with coordinates
        if (order.address && order.address.coordinates && order.address.coordinates.lat && order.address.coordinates.lng) {
          try {
            const distance = await calculateDistance(
              { lat: agentLocation.latitude, lng: agentLocation.longitude },
              { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
            );
            
            console.log(`Order ${order.id} distance: ${distance.toFixed(2)}km`);
            
            // Only include orders within 15km
            if (distance <= 15) {
              nearbyOrders.push({
                ...order,
                distance_km: Math.round(distance * 10) / 10 // Round to 1 decimal place
              });
            }
          } catch (distanceError) {
            console.warn(`Failed to calculate distance for order ${order.id}:`, distanceError);
            // Include order if distance calculation fails (backward compatibility)
            nearbyOrders.push(order);
          }
        } else {
          console.warn(`Order ${order.id} has no coordinates, including anyway`);
          // Include orders without coordinates (backward compatibility)
          nearbyOrders.push(order);
        }
      }
      
      filteredOrders = nearbyOrders;
      console.log(`After 15km filtering: ${filteredOrders.length} orders remain`);
    } else {
      console.log('No agent location available, skipping distance filtering');
    }

    console.log(`Found ${filteredOrders?.length || 0} available orders for agent:`, agent_id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: filteredOrders || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error in get-available-orders:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});