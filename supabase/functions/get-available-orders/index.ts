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

// Calculate agent payout based on distance - Match frontend structure
function calculateAgentPayout(distance: number): number {
  // Base fare for first 3 km: ₹40
  const baseFare = 40;
  
  // Additional distance beyond 3 km
  const additionalDistance = Math.max(0, distance - 3);
  
  // Per km rate for additional distance: ₹9
  const perKmRate = 9;
  const distanceFare = additionalDistance * perKmRate;
  
  // Subtotal before platform fee
  const subtotal = baseFare + distanceFare;
  
  // Peak hour surge: 15% if current time is peak
  const isPeakHour = () => {
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    const isLunchRush = currentHour >= 12 && currentHour < 14;
    const isDinnerRush = currentHour >= 19 && currentHour < 22;
    return isLunchRush || isDinnerRush || isWeekend;
  };
  
  const surgeAmount = isPeakHour() ? subtotal * 0.15 : 0;
  
  // Agent payout (total - platform fee of ₹13)
  const agentPayout = (subtotal + surgeAmount) - 13;
  
  return Math.max(12, Math.round(agentPayout * 100) / 100);
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
      console.log('Mapbox failed, using fallback for distance calculation:', mapboxError instanceof Error ? mapboxError.message : 'Unknown error');
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

    // First, automatically reassign stale orders from other agents (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { error: reassignError } = await supabase
      .from('orders')
      .update({ agent_id: null })
      .eq('status', 'packed')
      .not('agent_id', 'is', null)
      .not('agent_id', 'eq', agent_id)
      .lt('updated_at', thirtyMinutesAgo);

    if (reassignError) {
      console.warn('Failed to reassign stale orders:', reassignError);
    } else {
      console.log('Automatically reassigned stale orders older than 30 minutes');
    }

    // Get available orders - show only new, unassigned 'packed' orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *, 
        delivery_time, 
        delivery_time_slot, 
        delivery_date, 
        subscription_id
      `)
      .eq('status', 'packed')
      .is('agent_id', null)
      .order('created_at', { ascending: true }); // Show oldest orders first

    console.log('Raw query result:', orders?.map(o => ({ 
      id: o.id, 
      status: o.status, 
      agent_id: o.agent_id,
      updated_at: o.updated_at 
    })) || []);

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

    console.log(`Found ${orders?.length || 0} orders before filtering for agent:`, agent_id);
    console.log('Orders found:', orders?.map(o => ({ id: o.id, status: o.status, agent_id: o.agent_id })) || []);

    // Get delivery timings from database for consistent timing across frontend and backend
    const { data: deliveryTimings } = await supabase
      .from('delivery_timings')
      .select('*')
      .eq('is_active', true)
      .order('priority');

    // Get excluded order IDs for this agent
    const { data: exclusions, error: exclusionError } = await supabase
      .from('order_exclusions')
      .select('order_id')
      .eq('agent_id', agent_id);

    if (exclusionError) {
      console.warn('Failed to fetch exclusions:', exclusionError);
    }

    // Double-check: filter out any orders that somehow have an agent_id (safety check)
    let availableOrders = orders?.filter(order => order.agent_id === null && order.status === 'packed') || [];
    
    console.log(`After safety filter: ${availableOrders.length} orders remain`);
    
    // Filter out excluded orders and orders from restaurant/business sellers
    const excludedOrderIds = exclusions?.map(ex => ex.order_id) || [];
    let filteredOrders = availableOrders.filter(order => !excludedOrderIds.includes(order.id));
    
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

    // Process delivery slots based on order type - avoid synthetic slots for immediate orders
    const ordersWithSlots = await Promise.all(
      filteredOrders.map(async (order) => {
        const today = new Date().toISOString().split('T')[0];
        const orderCreatedAt = new Date(order.created_at);
        const now = new Date();
        const minutesSinceCreated = Math.floor((now.getTime() - orderCreatedAt.getTime()) / (1000 * 60));
        
        // Only process delivery slots for non-immediate orders
        const isImmediate = !order.subscription_id && 
                           (!order.delivery_time_slot || !order.delivery_time_slot.includes('-')) &&
                           (!order.delivery_date || order.delivery_date <= today) &&
                           minutesSinceCreated < 30; // Recent orders are likely immediate
        
        if (!isImmediate && order.delivery_time_slot) {
          try {
            let deliverySlot = null;
            
            // Validate delivery_time_slot is not null or empty
            const timeSlot = order.delivery_time_slot?.toString().trim();
            if (!timeSlot) {
              return order; // Skip processing if empty
            }
            
            if (timeSlot.includes('-')) {
              // Create a synthetic delivery slot for time range format like "02:00-04:00" or "16:00-18:00"
              const [startTime, endTime] = timeSlot.split('-');
              
              // Validate both parts exist and are valid times
              if (startTime && endTime) {
                const formatTime = (time: string) => {
                  const trimmed = time.trim();
                  // If time is already in HH:MM:SS format, use it
                  if (trimmed.match(/^\d{1,2}:\d{2}:\d{2}$/)) return trimmed;
                  // If time is in HH:MM format, add seconds
                  if (trimmed.match(/^\d{1,2}:\d{2}$/)) return `${trimmed}:00`;
                  // Return as-is for other formats
                  return trimmed;
                };
                
                deliverySlot = {
                  id: `slot-${order.id}`,
                  slot_name: `${timeSlot} window`,
                  start_time: formatTime(startTime),
                  end_time: formatTime(endTime)
                };
              }
            } else if (timeSlot.match(/^[0-9a-fA-F-]{36}$/)) {
              // Try to fetch from delivery_slots table (UUID format)
              const { data: slot } = await supabase
                .from('delivery_slots')
                .select('id, slot_name, start_time, end_time')
                .eq('id', timeSlot)
                .maybeSingle();
              deliverySlot = slot;
            } else if (timeSlot.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
              // Handle single time format - DON'T create synthetic ranges for actual delivery times
              // Instead, let the frontend handle display of single times
              const formatTime = (time: string) => {
                const trimmed = time.trim();
                // If time is already in HH:MM:SS format, use it
                if (trimmed.match(/^\d{1,2}:\d{2}:\d{2}$/)) return trimmed;
                // If time is in HH:MM format, add seconds
                if (trimmed.match(/^\d{1,2}:\d{2}$/)) return `${trimmed}:00`;
                return trimmed;
              };
              
              // Create proper time slots for subscription orders (morning delivery windows)
              if (order.subscription_id) {
                // Subscription orders get morning delivery windows
                deliverySlot = {
                  id: `slot-${order.id}`,
                  slot_name: 'Morning Delivery',
                  start_time: '06:00:00',
                  end_time: '10:00:00'
                };
              } else {
                // For scheduled orders with single time, create a 2-hour window
                const baseTime = new Date(`2000-01-01 ${formatTime(timeSlot)}`);
                const endTime = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000);
                
                deliverySlot = {
                  id: `slot-${order.id}`,
                  slot_name: `${timeSlot} delivery window`,
                  start_time: formatTime(timeSlot),
                  end_time: endTime.toTimeString().slice(0, 8)
                };
              }
            }
            
            return {
              ...order,
              delivery_slots: deliverySlot
            };
          } catch (slotError) {
            console.warn(`Failed to fetch delivery slot for order ${order.id}:`, slotError);
            return order;
          }
        }
        // For immediate orders (no subscription_id), return without delivery_slots
        return order;
      })
    );
    
    filteredOrders = ordersWithSlots;

    // Apply 15km radius filtering if agent location is available
    if (agentLocation && agentLocation.latitude && agentLocation.longitude) {
      console.log('Applying 15km radius filter for agent location:', {
        lat: agentLocation.latitude,
        lng: agentLocation.longitude
      });

      const nearbyOrders = [];
      
      for (const order of filteredOrders) {
        // Enhanced delivery type classification using database timings
        const orderCreatedAt = new Date(order.created_at);
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const minutesSinceCreated = Math.floor((now.getTime() - orderCreatedAt.getTime()) / (1000 * 60));
        
        let calculatedType: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later' = 'immediate';
        let properTimeSlot = order.delivery_time_slot;
        
        const orderAnalysis = {
          subscription_id: order.subscription_id,
          payment_status: order.payment_status,
          delivery_date: order.delivery_date,
          delivery_time_slot: order.delivery_time_slot,
          delivery_time: order.delivery_time,
          created_at: order.created_at,
          minutes_since_created: minutesSinceCreated
        };
        
        console.log(`Order ${order.id} analysis:`, JSON.stringify(orderAnalysis, null, 2));
        
        // Determine delivery type using proper logic and database timings
        // Check for immediate orders first (recent orders without specific scheduling)
        if (
          !order.subscription_id &&
          (!order.delivery_time_slot || order.delivery_time_slot === null || order.delivery_time_slot === '') &&
          (!order.delivery_date || order.delivery_date === today) && 
          minutesSinceCreated < 30
        ) {
          // Recent orders without specific scheduling should be immediate
          calculatedType = 'immediate';
          console.log(`Order ${order.id} -> immediate (recent order, no specific scheduling, created ${minutesSinceCreated} min ago)`);
        } else if (order.subscription_id) {
          calculatedType = 'subscription';
          // Get subscription timing from database
          const subscriptionTiming = deliveryTimings?.find(t => t.delivery_type === 'subscription');
          if (subscriptionTiming && !properTimeSlot) {
            properTimeSlot = `${subscriptionTiming.time_slot_start.slice(0, 5)}-${subscriptionTiming.time_slot_end.slice(0, 5)}`;
          }
          console.log(`Order ${order.id} -> subscription (has subscription_id, time: ${properTimeSlot})`);
        } else if (order.delivery_time_slot && order.delivery_time_slot.includes('-')) {
          calculatedType = 'scheduled';
          console.log(`Order ${order.id} -> scheduled (has time slot: ${order.delivery_time_slot})`);
        } else if (order.delivery_date && order.delivery_date !== today) {
          calculatedType = 'scheduled';
          // Assign appropriate scheduled timing if none exists
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            if (scheduledTiming) {
              properTimeSlot = `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}`;
            }
          }
          console.log(`Order ${order.id} -> scheduled (future date, time: ${properTimeSlot})`);
        } else if (order.delivery_time && order.delivery_time !== '12:00:00') {
          calculatedType = 'scheduled';
          console.log(`Order ${order.id} -> scheduled (specific time: ${order.delivery_time})`);
        } else if (order.payment_status === 'pending') {
          calculatedType = 'book_now_pay_later';
          console.log(`Order ${order.id} -> book_now_pay_later (pending payment)`);
        } else {
          calculatedType = 'immediate';
          console.log(`Order ${order.id} -> immediate (default fallback)`);
        }
        
        // Check if order has address with coordinates
        if (order.address && order.address.coordinates && order.address.coordinates.lat && order.address.coordinates.lng) {
          try {
            // Get pickup location from seller
            let pickupLocation = null;
            let pickupAddress = null;
            let sellerName = null;
            let sellerPhone = null;
            
            if (order.items && order.items.length > 0) {
              const sellerId = order.items[0].seller_id;
              if (sellerId) {
                const { data: seller } = await supabase
                  .from('sellers')
                  .select('name, phone, latitude, longitude, address, business_name')
                  .eq('user_id', sellerId)
                  .single();
                  
                if (seller && seller.latitude && seller.longitude) {
                  pickupLocation = {
                    lat: seller.latitude,
                    lng: seller.longitude
                  };
                  pickupAddress = seller.address || `${seller.business_name || seller.name}`;
                  sellerName = seller.business_name || seller.name;
                  sellerPhone = seller.phone;
                }
              }
            }
            
            // Calculate two-leg distance: Agent → Pickup → Customer
            let totalDistance = 0;
            
            if (pickupLocation) {
              // Leg 1: Agent to pickup location
              const distanceToPickup = await calculateDistance(
                { lat: agentLocation.latitude, lng: agentLocation.longitude },
                { lat: pickupLocation.lat, lng: pickupLocation.lng }
              );
              
              // Leg 2: Pickup to customer location
              const distanceToCustomer = await calculateDistance(
                { lat: pickupLocation.lat, lng: pickupLocation.lng },
                { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
              );
              
              totalDistance = distanceToPickup + distanceToCustomer;
            } else {
              // Fallback: Direct distance to customer
              totalDistance = await calculateDistance(
                { lat: agentLocation.latitude, lng: agentLocation.longitude },
                { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
              );
            }
            
            console.log(`Order ${order.id} total distance: ${totalDistance.toFixed(2)}km`);
            
            // Include orders within 15km radius
            if (totalDistance <= 15) {
              // Calculate shop-to-customer distance for accurate payout
              const shopToCustomerDistance = pickupLocation ? 
                await calculateDistance(
                  { lat: pickupLocation.lat, lng: pickupLocation.lng },
                  { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
                ).catch(() => totalDistance) : totalDistance;
              
              const agentPayout = calculateAgentPayout(shopToCustomerDistance);
              nearbyOrders.push({
                ...order,
                distance_km: shopToCustomerDistance, // Actual delivery distance (shop to customer)
                total_distance: totalDistance, // Total distance (agent to shop + shop to customer)
                agent_payout: agentPayout,
                estimated_delivery_time: Math.ceil(shopToCustomerDistance * 2), // 2 minutes per km for delivery
                backend_calculated: true,
                pickup_location: pickupLocation,
                pickup_address: pickupAddress,
                pickup_status: 'pending',
                seller_name: sellerName,
                seller_phone: sellerPhone,
                // Use calculated delivery type from timing database
                calculated_delivery_type: calculatedType,
                delivery_type: calculatedType,
                delivery_time_slot: properTimeSlot || order.delivery_time_slot,
                // Preserve original created_at for accurate timer calculations
                original_created_at: order.created_at
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