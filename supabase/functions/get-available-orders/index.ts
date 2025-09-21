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

// Calculate agent payout based on distance
function calculateAgentPayout(distance: number): number {
  const basePay = 20; // Base pay for first 1 km
  const additionalDistance = Math.max(0, distance - 1); // Distance beyond 1 km
  const perKmRate = 15; // Rate per km for additional distance
  const distancePay = additionalDistance * perKmRate;
  
  return Math.round((basePay + distancePay) * 100) / 100; // Round to 2 decimal places
}
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
      .maybeSingle();

    if (locationError) {
      console.warn('Failed to get agent location:', locationError);
      // If no location found, return all orders (backward compatibility)
    }

    // Get available orders - show 'packed' orders for everyone, and 'assigned' orders for current agent
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, delivery_time, delivery_time_slot, delivery_date, subscription_id')
      .or(`status.eq.packed,and(status.eq.assigned,agent_id.eq.${agent_id})`);

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

    // Filter out excluded orders and orders from restaurant/business sellers
    const excludedOrderIds = exclusions?.map(ex => ex.order_id) || [];
    let filteredOrders = orders?.filter(order => !excludedOrderIds.includes(order.id)) || [];
    
    // Filter out orders from sellers/restaurants - only exclude pure business sellers
    const userOrdersPromises = filteredOrders.map(async (order) => {
      try {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', order.user_id);
          
        // Exclude orders only from users who are pure sellers (have seller role but no other roles)
        const hasSellerRole = userRoles?.some(ur => ur.role === 'seller') || false;
        const hasOtherRoles = userRoles?.some(ur => ur.role !== 'seller') || false;
        
        // Show orders from everyone except pure business sellers
        return hasSellerRole && !hasOtherRoles ? null : order;
      } catch (error) {
        console.warn(`Failed to check user role for order ${order.id}, including by default:`, error);
        return order; // Include by default on error
      }
    });
    
    const resolvedOrders = await Promise.all(userOrdersPromises);
    filteredOrders = resolvedOrders.filter(order => order !== null);

    // Apply 15km radius filtering if agent location is available
    if (agentLocation && agentLocation.latitude && agentLocation.longitude) {
      console.log('Applying 15km radius filter for agent location:', {
        lat: agentLocation.latitude,
        lng: agentLocation.longitude
      });

      const nearbyOrders = [];
      
      for (const order of filteredOrders) {
        // Skip distance filtering for orders already assigned to this agent
        if (order.status === 'assigned' && order.agent_id === agent_id) {
          const existingDistance = order.distance_km || 0;
          const agentPayout = calculateAgentPayout(existingDistance);
          nearbyOrders.push({
            ...order,
            distance_km: existingDistance,
            agent_payout: agentPayout,
            estimated_time_minutes: Math.ceil(existingDistance * 2)
          });
          continue;
        }
        
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
              const agentPayout = calculateAgentPayout(distance);
              nearbyOrders.push({
                ...order,
                distance_km: Math.round(distance * 10) / 10, // Round to 1 decimal place
                agent_payout: agentPayout,
                estimated_time_minutes: Math.ceil(distance * 2) // 2 minutes per km
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