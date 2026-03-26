import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zepto/Blinkit style pricing for regular orders
const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
};

/**
 * Calculate road distance using Google Distance Matrix API
 * Returns distance in km, rounded UP to 1 decimal (Zepto style)
 * NO HAVERSINE FALLBACK - returns null if routing fails
 */
// Round coordinate to 3 decimal places (~111m precision) for cache key
function roundCoord(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// Supabase client reference set inside serve() handler
let _supabaseClient: any = null;

/**
 * Check distance_cache table for a cached distance
 */
async function getCachedDistance(
  oLat: number, oLng: number, dLat: number, dLng: number
): Promise<number | null> {
  if (!_supabaseClient) return null;
  try {
    const { data } = await _supabaseClient
      .from('distance_cache')
      .select('distance_km')
      .match({
        origin_lat: oLat,
        origin_lng: oLng,
        dest_lat: dLat,
        dest_lng: dLng,
      })
      .maybeSingle();
    return data?.distance_km ?? null;
  } catch {
    return null;
  }
}

/**
 * Store distance in cache table
 */
async function setCachedDistance(
  oLat: number, oLng: number, dLat: number, dLng: number, distanceKm: number
): Promise<void> {
  if (!_supabaseClient) return;
  try {
    await _supabaseClient
      .from('distance_cache')
      .upsert({
        origin_lat: oLat,
        origin_lng: oLng,
        dest_lat: dLat,
        dest_lng: dLng,
        distance_km: distanceKm,
      }, { onConflict: 'origin_lat,origin_lng,dest_lat,dest_lng' });
  } catch (e) {
    console.warn('Failed to cache distance:', e);
  }
}

async function calculateRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> {
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  
  if (!googleApiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured - cannot calculate road distance');
    return null;
  }

  // Round coords for cache key
  const oLat = roundCoord(origin.lat);
  const oLng = roundCoord(origin.lng);
  const dLat = roundCoord(destination.lat);
  const dLng = roundCoord(destination.lng);

  // Check cache first
  const cached = await getCachedDistance(oLat, oLng, dLat, dLng);
  if (cached !== null) {
    console.log(`📦 Cache HIT: (${oLat},${oLng})→(${dLat},${dLng}) = ${cached}km`);
    return cached;
  }

  try {
    const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${googleApiKey}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.error('Google Distance Matrix error:', data.status, data.error_message);
      return null;
    }
    
    const element = data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      console.error('Google element status error:', element.status);
      return null;
    }
    
    const distanceMeters = element.distance.value;
    const rawDistanceKm = distanceMeters / 1000;
    const roundedDistanceKm = Math.ceil(rawDistanceKm * 10) / 10;
    const result = Math.max(0.1, roundedDistanceKm);

    // Store in cache
    console.log(`🌐 Cache MISS: (${oLat},${oLng})→(${dLat},${dLng}) = ${result}km → saving`);
    await setCachedDistance(oLat, oLng, dLat, dLng, result);

    return result;
  } catch (error) {
    console.error('Google Distance Matrix API error:', error);
    return null;
  }
}

/**
 * Calculate agent payout using Zepto/Blinkit formula
 * ₹10 base + ₹8/km
 */
function calculateAgentPayout(distanceKm: number): number {
  const roundedDistance = Math.ceil(distanceKm * 10) / 10; // Always round UP
  const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
  const totalPayout = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
  return Math.round(totalPayout * 10) / 10;
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
    _supabaseClient = supabase;

    const { agent_id } = await req.json();
    console.log('Getting available orders for agent (auth user ID):', agent_id);

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

    // Resolve agent's primary key from delivery_agents table
    const { data: agentData, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', agent_id)
      .single();

    if (agentError || !agentData) {
      console.error('Agent not found:', agent_id);
      console.error('Agent error details:', agentError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Agent profile not found. Please complete your registration.',
          error_code: 'AGENT_NOT_FOUND',
          agent_id: agent_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const deliveryAgentId = agentData.id;
    console.log('Resolved delivery agent ID:', deliveryAgentId);

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
    }

    // STEP 1: Fetch ALL completed order IDs from delivery_history FIRST
    // delivery_history is the SOURCE OF TRUTH for completion (Zepto pattern)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: completedOrderIds, error: completedError } = await supabase
      .from('delivery_history')
      .select('order_id')
      .gte('completed_at', sevenDaysAgo);
    
    if (completedError) {
      console.warn('Failed to fetch completed orders from delivery_history:', completedError);
    }
    
    const completedIds = new Set(completedOrderIds?.map(c => c.order_id) || []);
    console.log(`[COMPLETION FILTER] Found ${completedIds.size} completed orders in delivery_history to exclude`);

    // STEP 2: Reassign stale orders with HARDENED logic
    // DO NOT reassign orders that:
    // - Exist in delivery_history (already completed)
    // - Have payment_status = 'paid' (money already collected)
    // - Are subscription orders
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Build list of order IDs to exclude from reassignment
    const completedIdsList = Array.from(completedIds);
    
    // Only reassign if we have orders to exclude OR if the set is empty
    if (completedIdsList.length > 0) {
      // Reassign stale packed orders, excluding completed ones
      const { error: reassignError } = await supabase
        .from('orders')
        .update({ agent_id: null })
        .eq('status', 'packed')
        .is('subscription_id', null)  // Only regular orders
        .not('agent_id', 'is', null)
        .not('agent_id', 'eq', deliveryAgentId)
        .neq('payment_status', 'paid')  // Don't reassign paid orders
        .not('id', 'in', `(${completedIdsList.join(',')})`)  // Don't reassign completed orders
        .lt('updated_at', thirtyMinutesAgo);

      if (reassignError) {
        console.warn('Failed to reassign stale orders:', reassignError);
      } else {
        console.log('✅ Reassigned stale orders (excluded completed, paid, subscription orders)');
      }
    } else {
      // No completed orders to exclude
      const { error: reassignError } = await supabase
        .from('orders')
        .update({ agent_id: null })
        .eq('status', 'packed')
        .is('subscription_id', null)
        .not('agent_id', 'is', null)
        .not('agent_id', 'eq', deliveryAgentId)
        .neq('payment_status', 'paid')
        .lt('updated_at', thirtyMinutesAgo);

      if (reassignError) {
        console.warn('Failed to reassign stale orders:', reassignError);
      } else {
        console.log('✅ Reassigned stale orders (no completed orders to exclude)');
      }
    }

    // Get two types of orders:
    // 1. Available orders (packed, unassigned) - for agent to accept
    // 2. Agent's own active orders - to track their deliveries until completion
    //    Include all active statuses: assigned, accepted, picked_up, out_for_delivery, payment_pending
    
    // Query: Get available orders (packed, unassigned) OR agent's active orders (multiple statuses)
    // Check BOTH agent_id AND assigned_agent_id columns for robustness
    // CRITICAL: Exclude terminal statuses at DATABASE LEVEL to prevent delivered orders from showing
    const activeStatuses = ['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'payment_pending'];
    const terminalStatusesForQuery = ['delivered', 'completed', 'cancelled', 'canceled'];
    
    // STEP 3: Fetch orders (sevenDaysAgo already defined above)
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *, 
        delivery_time, 
        delivery_time_slot, 
        delivery_date, 
        subscription_id
      `)
      .not('status', 'in', `(${terminalStatusesForQuery.join(',')})`)  // CRITICAL: Exclude terminal statuses at DB level
      .gte('created_at', sevenDaysAgo)  // Only orders from last 7 days
      .or(`and(status.eq.packed,agent_id.is.null,assigned_agent_id.is.null),and(status.in.(${activeStatuses.join(',')}),or(agent_id.eq.${deliveryAgentId},assigned_agent_id.eq.${deliveryAgentId}))`)
      .order('created_at', { ascending: true }); // Show oldest orders first
    
    console.log(`[DB FILTER] Excluded terminal statuses: ${terminalStatusesForQuery.join(', ')}, only orders since: ${sevenDaysAgo}`);

    // NOTE: completedIds already fetched at the top (Step 1) - no need to fetch again

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

    console.log(`Found ${orders?.length || 0} orders before filtering for agent ${deliveryAgentId} (auth: ${agent_id})`);
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
      .eq('agent_id', deliveryAgentId);

    if (rejectionError) {
      console.warn('Failed to fetch rejected orders:', rejectionError);
    }
    
    console.log(`Agent ${deliveryAgentId} (auth: ${agent_id}) has ${rejections?.length || 0} rejected orders`);

    // Filter: Keep available orders (both columns null) OR orders assigned to current agent (either column)
    // CRITICAL: Use delivery_history as THE SOURCE OF TRUTH for completion (Zepto pattern)
    // An order is considered complete if it exists in delivery_history, regardless of orders.status
    const terminalStatuses = ['delivered', 'completed', 'cancelled', 'canceled'];
    const activeStatusSet = new Set(['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'payment_pending']);
    
    let availableOrders = orders?.filter(order => {
      // FIRST: Check delivery_history (SOURCE OF TRUTH) - if order was completed, exclude it
      if (completedIds.has(order.id)) {
        console.log(`🚫 Excluding ${order.id}: found in delivery_history (completed)`);
        return false;
      }
      
      // SECOND: Check orders.status as backup - exclude terminal statuses
      const status = order.status?.toLowerCase();
      if (terminalStatuses.includes(status)) {
        console.log(`🚫 Excluding ${order.id}: terminal status ${order.status}`);
        return false;
      }
      
      // Exclude orphaned payment_pending orders (no agent assigned)
      const isOrphanedPaymentPending = order.status === 'payment_pending' && 
                                        order.agent_id === null && 
                                        order.assigned_agent_id === null;
      if (isOrphanedPaymentPending) {
        console.log(`🚫 Excluding orphaned payment_pending order ${order.id}`);
        return false;
      }
      
      // Available orders: packed + unassigned
      const isAvailable = order.agent_id === null && 
                          order.assigned_agent_id === null && 
                          order.status === 'packed';
      
      // Agent's active orders: assigned to current agent with active status
      const isAgentOrder = (order.agent_id === deliveryAgentId || order.assigned_agent_id === deliveryAgentId) && 
                           activeStatusSet.has(order.status);
      
      return isAvailable || isAgentOrder;
    }) || [];
    
    console.log(`✅ After double-verification filter: ${availableOrders.length} orders remain (excluded ${completedIds.size} from delivery_history)`);
    
    // Filter out rejected orders (only applies to available orders, not assigned ones)
    const rejectedOrderIds = rejections?.map(r => r.order_id) || [];
    let filteredOrders = availableOrders.filter(order => {
      // Don't filter out orders already assigned to this agent (check BOTH columns)
      if (order.agent_id === deliveryAgentId || order.assigned_agent_id === deliveryAgentId) return true;
      // Filter out rejected available orders
      return !rejectedOrderIds.includes(order.id);
    });
    
    if (rejectedOrderIds.length > 0) {
      console.log(`Filtered out ${rejectedOrderIds.length} rejected orders for agent ${deliveryAgentId}`);
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
                           minutesSinceCreated < 30;
        
        if (!isImmediate && order.delivery_time_slot) {
          try {
            let deliverySlot = null;
            
            const timeSlot = order.delivery_time_slot?.toString().trim();
            if (!timeSlot) {
              return order;
            }
            
            if (timeSlot.includes('-')) {
              const [startTime, endTime] = timeSlot.split('-');
              
              if (startTime && endTime) {
                const formatTime = (time: string) => {
                  const trimmed = time.trim();
                  if (trimmed.match(/^\d{1,2}:\d{2}:\d{2}$/)) return trimmed;
                  if (trimmed.match(/^\d{1,2}:\d{2}$/)) return `${trimmed}:00`;
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
              const { data: slot } = await supabase
                .from('delivery_slots')
                .select('id, slot_name, start_time, end_time')
                .eq('id', timeSlot)
                .maybeSingle();
              deliverySlot = slot;
            } else if (timeSlot.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
              const formatTime = (time: string) => {
                const trimmed = time.trim();
                if (trimmed.match(/^\d{1,2}:\d{2}:\d{2}$/)) return trimmed;
                if (trimmed.match(/^\d{1,2}:\d{2}$/)) return `${trimmed}:00`;
                return trimmed;
              };
              
              if (order.subscription_id) {
                deliverySlot = {
                  id: `slot-${order.id}`,
                  slot_name: 'Morning Delivery',
                  start_time: '06:00:00',
                  end_time: '10:00:00'
                };
              } else {
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
        return order;
      })
    );
    
    filteredOrders = ordersWithSlots;

    // Apply 10km radius filtering if agent location is available
    if (agentLocation && agentLocation.latitude && agentLocation.longitude) {
      console.log('Applying 10km radius filter for agent location:', {
        lat: agentLocation.latitude,
        lng: agentLocation.longitude
      });

      const nearbyOrders = [];
      
      for (const order of filteredOrders) {
        const orderCreatedAt = new Date(order.created_at);
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const minutesSinceCreated = Math.floor((now.getTime() - orderCreatedAt.getTime()) / (1000 * 60));
        
        let calculatedType: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later' = 'immediate';
        let properTimeSlot = order.delivery_time_slot;
        let immediateTimingConfig = null;
        
        // Determine delivery type
        if (order.subscription_id) {
          calculatedType = 'subscription';
          const subscriptionTiming = deliveryTimings?.find(t => t.delivery_type === 'subscription');
          if (subscriptionTiming && !properTimeSlot) {
            properTimeSlot = `${subscriptionTiming.time_slot_start.slice(0, 5)}-${subscriptionTiming.time_slot_end.slice(0, 5)}`;
          } else if (!properTimeSlot) {
            properTimeSlot = '06:00-10:00';
          }
        } else if (order.delivery_time_slot && order.delivery_time_slot.trim() && order.delivery_time_slot.includes('-')) {
          calculatedType = 'scheduled';
          properTimeSlot = order.delivery_time_slot.trim();
        } else if (order.delivery_date && order.delivery_date !== today) {
          calculatedType = 'scheduled';
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            if (scheduledTiming) {
              properTimeSlot = `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}`;
            } else {
              properTimeSlot = '09:00-12:00';
            }
          }
        } else if (order.delivery_time && order.delivery_time !== '12:00:00' && order.delivery_time.trim()) {
          calculatedType = 'scheduled';
        } else if (order.payment_status && order.payment_status.toLowerCase().includes('paid_subscription')) {
          calculatedType = 'subscription';
          if (!properTimeSlot) {
            properTimeSlot = '06:00-10:00';
          }
        } else if (
          !order.subscription_id &&
          (!order.delivery_time_slot || order.delivery_time_slot === null || order.delivery_time_slot === '' || order.delivery_time_slot.trim() === '') &&
          (!order.delivery_date || order.delivery_date === today) && 
          minutesSinceCreated < 45 &&
          (!order.delivery_time || order.delivery_time === '12:00:00')
        ) {
          calculatedType = 'immediate';
          const immediateTiming = deliveryTimings?.find(t => t.delivery_type === 'immediate');
          if (immediateTiming) {
            immediateTimingConfig = {
              max_duration_minutes: immediateTiming.max_duration_minutes,
              time_slot_start: immediateTiming.time_slot_start,
              time_slot_end: immediateTiming.time_slot_end,
              slot_name: immediateTiming.slot_name
            };
          } else {
            immediateTimingConfig = {
              max_duration_minutes: 20,
              time_slot_start: '00:00:00',
              time_slot_end: '23:59:59',
              slot_name: 'Immediate Delivery'
            };
          }
        } else if (order.payment_status === 'pending') {
          calculatedType = 'book_now_pay_later';
        } else {
          calculatedType = 'scheduled';
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            if (scheduledTiming) {
              properTimeSlot = `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}`;
            } else {
              properTimeSlot = '09:00-12:00';
            }
          }
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
            
            // Calculate ROAD distance using Mapbox (NO Haversine fallback)
            let shopToCustomerDistance: number | null = null;
            let agentToShopDistance: number | null = null;
            
            if (pickupLocation) {
              // Leg 1: Agent to pickup location (for filtering only)
              agentToShopDistance = await calculateRoadDistance(
                { lat: agentLocation.latitude, lng: agentLocation.longitude },
                { lat: pickupLocation.lat, lng: pickupLocation.lng }
              );
              
              // Leg 2: Pickup to customer location (for payout calculation)
              shopToCustomerDistance = await calculateRoadDistance(
                { lat: pickupLocation.lat, lng: pickupLocation.lng },
                { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
              );
              
              if (agentToShopDistance !== null && shopToCustomerDistance !== null) {
                console.log(`✅ Order ${order.id} road distances - Agent→Shop: ${agentToShopDistance}km, Shop→Customer: ${shopToCustomerDistance}km`);
              } else {
                console.warn(`⚠️ Order ${order.id} - Could not calculate road distance, skipping`);
                continue; // Skip orders where road distance cannot be calculated
              }
            } else {
              // Direct distance to customer if no pickup location
              shopToCustomerDistance = await calculateRoadDistance(
                { lat: agentLocation.latitude, lng: agentLocation.longitude },
                { lat: order.address.coordinates.lat, lng: order.address.coordinates.lng }
              );
              agentToShopDistance = shopToCustomerDistance;
              
              if (shopToCustomerDistance === null) {
                console.warn(`⚠️ Order ${order.id} - Could not calculate road distance, skipping`);
                continue;
              }
            }
            
            const totalDistance = (agentToShopDistance || 0) + (shopToCustomerDistance || 0);
            
            // Include orders within 10km radius
            if (totalDistance <= 10) {
              // Minimum distance for payout
              const payoutDistance = Math.max(0.1, shopToCustomerDistance || 0.1);
              
              // Calculate payout using Zepto/Blinkit formula: ₹10 base + ₹8/km
              const agentPayout = calculateAgentPayout(payoutDistance);
              const estimatedTime = Math.max(5, Math.ceil(payoutDistance * 2));
              
              console.log(`✅ Order ${order.id} - Distance: ${payoutDistance}km, Payout: ₹${agentPayout} (₹10 + ${payoutDistance}×₹8)`);
              
              nearbyOrders.push({
                ...order,
                distance_km: payoutDistance,
                agent_to_shop_distance: agentToShopDistance,
                total_distance: totalDistance,
                agent_payout: agentPayout,
                estimated_delivery_time: estimatedTime,
                backend_calculated: true,
                road_distance: true, // Flag indicating this is road distance, not Haversine
                pickup_location: pickupLocation,
                pickup_address: pickupAddress,
                pickup_status: 'pending',
                seller_name: sellerName,
                seller_phone: sellerPhone,
                calculated_delivery_type: calculatedType,
                delivery_type: calculatedType,
                delivery_time_slot: properTimeSlot || order.delivery_time_slot,
                original_created_at: order.created_at,
                immediate_timing_config: immediateTimingConfig,
                // Include payout breakdown for transparency
                payout_breakdown: {
                  base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
                  distance_pay: Math.round((payoutDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE) * 10) / 10,
                  distance_km: payoutDistance,
                  rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE
                }
              });
            } else {
              console.log(`❌ Order ${order.id} too far: ${totalDistance}km > 10km`);
            }
          } catch (distanceError) {
            console.error(`Failed to calculate distance for order ${order.id}:`, distanceError);
            // DO NOT include orders if road distance cannot be calculated
          }
        } else {
          console.warn(`Order ${order.id} has no coordinates, skipping (road distance required)`);
          // DO NOT include orders without coordinates
        }
      }
      
      filteredOrders = nearbyOrders;
      console.log(`After 10km filtering with road distance: ${filteredOrders.length} orders remain`);
    } else {
      console.log('No agent location available - using stored distance for payout calculation');
      
      // Still process orders with stored distance or default payout
      filteredOrders = filteredOrders.map(order => {
        // Skip subscription orders (no payout)
        if (order.subscription_id || order.order_type === 'subscription') {
          return { ...order, agent_payout: 0, payout_breakdown: null };
        }
        
        // Use stored distance_km from order, or default to 2.5km
        const storedDistance = order.distance_km || 2.5;
        const roundedDistance = Math.ceil(storedDistance * 10) / 10;
        
        // Calculate payout using Zepto formula: ₹10 base + ₹8/km
        const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
        const agentPayout = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
        
        return {
          ...order,
          distance_km: roundedDistance,
          agent_payout: Math.round(agentPayout * 10) / 10,
          estimated_delivery_time: Math.max(5, Math.ceil(roundedDistance * 2)),
          payout_breakdown: {
            base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
            distance_pay: Math.round(distancePay * 10) / 10,
            distance_km: roundedDistance,
            rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE
          }
        };
      });
    }

    console.log(`Found ${filteredOrders?.length || 0} available orders for agent ${deliveryAgentId} (auth: ${agent_id})`);
    
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
