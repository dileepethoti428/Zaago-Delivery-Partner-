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

    // Get two types of orders:
    // 1. Available orders (packed, unassigned) - for agent to accept
    // 2. Agent's own active orders (assigned/picked_up by this agent) - to track their deliveries
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *, 
        delivery_time, 
        delivery_time_slot, 
        delivery_date, 
        subscription_id
      `)
      .or(`and(status.eq.packed,agent_id.is.null),and(status.in.(assigned,picked_up),agent_id.eq.${agent_id})`)
      .order('created_at', { ascending: true }); // Show oldest orders first

    // Filter out any orders that have been completed
    const { data: completedOrderIds } = await supabase
      .from('delivery_completions')
      .select('order_id')
      .eq('status', 'completed');
    
    const completedIds = new Set(completedOrderIds?.map(c => c.order_id) || []);

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

    // Get rejected order IDs for this agent
    const { data: rejections, error: rejectionError } = await supabase
      .from('agent_order_rejections')
      .select('order_id')
      .eq('agent_id', agent_id);

    if (rejectionError) {
      console.warn('Failed to fetch rejected orders:', rejectionError);
    }
    
    console.log(`Agent ${agent_id} has ${rejections?.length || 0} rejected orders`);

    // Filter: Keep available orders (agent_id=null) OR orders assigned to current agent
    // Also exclude orders that have been completed (are in delivery_completions)
    let availableOrders = orders?.filter(order => 
      ((order.agent_id === null && order.status === 'packed') || 
       (order.agent_id === agent_id && ['assigned', 'picked_up'].includes(order.status))) &&
      !completedIds.has(order.id)
    ) || [];
    
    console.log(`After safety filter (excluding ${completedIds.size} completed orders): ${availableOrders.length} orders remain`);
    
    // Filter out rejected orders (only applies to available orders, not assigned ones)
    const rejectedOrderIds = rejections?.map(r => r.order_id) || [];
    let filteredOrders = availableOrders.filter(order => {
      // Don't filter out orders already assigned to this agent
      if (order.agent_id === agent_id) return true;
      // Filter out rejected available orders
      return !rejectedOrderIds.includes(order.id);
    });
    
    if (rejectedOrderIds.length > 0) {
      console.log(`Filtered out ${rejectedOrderIds.length} rejected orders for agent ${agent_id}`);
    }
    
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
        let immediateTimingConfig = null;
        
        // Enhanced classification order - most specific first with better detection
        if (order.subscription_id) {
          calculatedType = 'subscription';
          // Get subscription timing from database or use default morning window
          const subscriptionTiming = deliveryTimings?.find(t => t.delivery_type === 'subscription');
          if (subscriptionTiming && !properTimeSlot) {
            properTimeSlot = `${subscriptionTiming.time_slot_start.slice(0, 5)}-${subscriptionTiming.time_slot_end.slice(0, 5)}`;
          } else if (!properTimeSlot) {
            properTimeSlot = '06:00-10:00'; // Default subscription window
          }
          console.log(`Order ${order.id} -> subscription (has subscription_id: ${order.subscription_id}, time: ${properTimeSlot})`);
        } else if (order.delivery_time_slot && order.delivery_time_slot.trim() && order.delivery_time_slot.includes('-')) {
          calculatedType = 'scheduled';
          properTimeSlot = order.delivery_time_slot.trim();
          console.log(`Order ${order.id} -> scheduled (has time slot: ${order.delivery_time_slot})`);
        } else if (order.delivery_date && order.delivery_date !== today) {
          calculatedType = 'scheduled';
          // Assign appropriate scheduled timing if none exists
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            if (scheduledTiming) {
              properTimeSlot = `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}`;
            } else {
              properTimeSlot = '09:00-12:00'; // Default scheduled window
            }
          }
          console.log(`Order ${order.id} -> scheduled (future date: ${order.delivery_date}, time: ${properTimeSlot})`);
        } else if (order.delivery_time && order.delivery_time !== '12:00:00' && order.delivery_time.trim()) {
          calculatedType = 'scheduled';
          console.log(`Order ${order.id} -> scheduled (specific time: ${order.delivery_time})`);
        } else if (order.payment_status && (order.payment_status.toLowerCase().includes('paid_subscription') || order.payment_status.toLowerCase() === 'paid_subscription')) {
          // Additional check for subscription orders via payment status
          calculatedType = 'subscription';
          if (!properTimeSlot) {
            properTimeSlot = '06:00-10:00'; // Default subscription window
          }
          console.log(`Order ${order.id} -> subscription (payment status indicates subscription: ${order.payment_status})`);
        } else if (
          // Check for immediate orders (recent orders without specific scheduling)
          !order.subscription_id &&
          (!order.delivery_time_slot || order.delivery_time_slot === null || order.delivery_time_slot === '' || order.delivery_time_slot.trim() === '') &&
          (!order.delivery_date || order.delivery_date === today) && 
          minutesSinceCreated < 45 && // Reduced to 45 minutes for more accurate immediate classification
          (!order.delivery_time || order.delivery_time === '12:00:00') // No specific delivery time or default time
        ) {
          // Recent orders without specific scheduling should be immediate
          calculatedType = 'immediate';
          
          // Get immediate delivery timing configuration from database
          const immediateTiming = deliveryTimings?.find(t => t.delivery_type === 'immediate');
          if (immediateTiming) {
            immediateTimingConfig = {
              max_duration_minutes: immediateTiming.max_duration_minutes,
              time_slot_start: immediateTiming.time_slot_start,
              time_slot_end: immediateTiming.time_slot_end,
              slot_name: immediateTiming.slot_name
            };
            console.log(`Order ${order.id} -> immediate (recent order, no specific scheduling, created ${minutesSinceCreated} min ago) - using ${immediateTiming.max_duration_minutes}min timing`);
          } else {
            // Fallback to 20 minutes if no database config
            immediateTimingConfig = {
              max_duration_minutes: 20,
              time_slot_start: '00:00:00',
              time_slot_end: '23:59:59',
              slot_name: 'Immediate Delivery'
            };
            console.log(`Order ${order.id} -> immediate (recent order, no specific scheduling, created ${minutesSinceCreated} min ago) - using fallback 20min timing`);
          }
        } else if (order.payment_status === 'pending') {
          calculatedType = 'book_now_pay_later';
          console.log(`Order ${order.id} -> book_now_pay_later (pending payment)`);
        } else {
          // Orders that don't meet immediate criteria should be classified as scheduled with better detection
          calculatedType = 'scheduled';
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            if (scheduledTiming) {
              properTimeSlot = `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}`;
            } else {
              properTimeSlot = '09:00-12:00'; // Default fallback
            }
          }
          console.log(`Order ${order.id} -> scheduled (fallback classification, minutes since created: ${minutesSinceCreated}, delivery_date: ${order.delivery_date}, time_slot: ${order.delivery_time_slot})`);
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
            
            // Calculate two-leg distance: Agent → Pickup → Customer with error handling
            let totalDistance = 2.5; // Default fallback
            let agentToShopDistance = 2.5; // Default fallback
            
            try {
              if (pickupLocation) {
                // Leg 1: Agent to pickup location
                try {
                  const distanceToPickup = await calculateDistance(
                    { lat: agentLocation.latitude, lng: agentLocation.longitude },
                    { lat: pickupLocation.lat, lng: pickupLocation.lng }
                  );
                  agentToShopDistance = Number(distanceToPickup.toFixed(2));
                  console.log(`✅ Agent to shop distance: ${agentToShopDistance}km`);
                } catch (distError) {
                  console.warn(`⚠️ Failed to calculate agent-to-shop distance for order ${order.id}, using fallback`);
                  agentToShopDistance = 2.5;
                }
                
                // Leg 2: Pickup to customer location
                try {
                  const distanceToCustomer = await calculateDistance(
                    { lat: pickupLocation.lat, lng: pickupLocation.lng },
                    { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
                  );
                  totalDistance = Number((agentToShopDistance + distanceToCustomer).toFixed(2));
                  console.log(`✅ Total distance (agent→shop→customer): ${totalDistance}km`);
                } catch (distError) {
                  console.warn(`⚠️ Failed to calculate shop-to-customer distance for order ${order.id}, using fallback`);
                  totalDistance = agentToShopDistance + 2.5;
                }
              } else {
                // Fallback: Direct distance to customer
                try {
                  totalDistance = await calculateDistance(
                    { lat: agentLocation.latitude, lng: agentLocation.longitude },
                    { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
                  );
                  totalDistance = Number(totalDistance.toFixed(2));
                  agentToShopDistance = totalDistance;
                  console.log(`✅ Direct distance to customer: ${totalDistance}km`);
                } catch (distError) {
                  console.warn(`⚠️ Failed to calculate direct distance for order ${order.id}, using fallback`);
                  totalDistance = 2.5;
                  agentToShopDistance = 2.5;
                }
              }
            } catch (error) {
              console.error(`❌ Error calculating distances for order ${order.id}:`, error);
              totalDistance = 2.5;
              agentToShopDistance = 2.5;
            }
            
            console.log(`📊 Order ${order.id} - Agent→Shop: ${agentToShopDistance}km, Total: ${totalDistance}km`);
            
            // Include orders within 15km radius
            if (totalDistance <= 15) {
              // Calculate shop-to-customer distance for accurate payout with error handling
              let shopToCustomerDistance = totalDistance - agentToShopDistance;
              
              if (pickupLocation && shopToCustomerDistance <= 0) {
                try {
                  shopToCustomerDistance = await calculateDistance(
                    { lat: pickupLocation.lat, lng: pickupLocation.lng },
                    { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
                  );
                  shopToCustomerDistance = Number(shopToCustomerDistance.toFixed(2));
                  console.log(`✅ Shop to customer distance recalculated: ${shopToCustomerDistance}km`);
                } catch (error) {
                  console.warn(`⚠️ Failed to recalculate shop-to-customer distance, using fallback`);
                  shopToCustomerDistance = 2.5;
                }
              }
              
              // Ensure positive distance
              shopToCustomerDistance = Math.max(0.5, shopToCustomerDistance);
              
              // Calculate payout - ensure it's always valid
              const agentPayout = Number(calculateAgentPayout(shopToCustomerDistance).toFixed(2));
              const estimatedTime = Math.max(5, Math.ceil(shopToCustomerDistance * 2)); // Minimum 5 minutes
              
              // Validate all numeric fields before adding
              if (isNaN(agentToShopDistance) || isNaN(totalDistance) || isNaN(agentPayout)) {
                console.error(`❌ Invalid numeric values for order ${order.id}, skipping`);
              } else {
                console.log(`✅ Adding order ${order.id} with payout: ₹${agentPayout}`);
                nearbyOrders.push({
                  ...order,
                  distance_km: Number(shopToCustomerDistance.toFixed(2)), // Actual delivery distance (shop to customer)
                  agent_to_shop_distance: Number(agentToShopDistance.toFixed(2)), // Distance from agent's location to pickup shop
                  total_distance: Number(totalDistance.toFixed(2)), // Total distance (agent to shop + shop to customer)
                  agent_payout: Number(agentPayout.toFixed(2)),
                  estimated_delivery_time: Number(estimatedTime), // 2 minutes per km for delivery
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
                  original_created_at: order.created_at,
                  // Add immediate timing configuration for frontend
                  immediate_timing_config: immediateTimingConfig
                });
              }
            } else {
              console.log(`❌ Order ${order.id} too far: ${totalDistance}km > 15km`);
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