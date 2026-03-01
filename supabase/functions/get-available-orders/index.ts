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
 * Batch calculate road distances using Google Distance Matrix API
 * Supports up to 25 origins × 25 destinations per request
 * Returns a flat array of distances in km (same order as origin-destination pairs)
 */
async function batchCalculateRoadDistances(
  pairs: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }>
): Promise<Array<number | null>> {
  if (pairs.length === 0) return [];

  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!googleApiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured');
    return pairs.map(() => null);
  }

  // Google allows max 25 origins × 25 destinations per request
  // We use 1 origin at a time with multiple destinations for simplicity
  // Group pairs by unique origin to minimize API calls
  const originGroups = new Map<string, { origin: { lat: number; lng: number }; destIndices: number[]; destinations: Array<{ lat: number; lng: number }> }>();

  pairs.forEach((pair, idx) => {
    const key = `${pair.origin.lat},${pair.origin.lng}`;
    if (!originGroups.has(key)) {
      originGroups.set(key, { origin: pair.origin, destIndices: [], destinations: [] });
    }
    const group = originGroups.get(key)!;
    group.destIndices.push(idx);
    group.destinations.push(pair.destination);
  });

  const results: Array<number | null> = new Array(pairs.length).fill(null);

  // Make parallel API calls for each origin group (typically 1-2 groups)
  const apiCalls = Array.from(originGroups.values()).map(async (group) => {
    // Split destinations into chunks of 25
    for (let i = 0; i < group.destinations.length; i += 25) {
      const chunk = group.destinations.slice(i, i + 25);
      const chunkIndices = group.destIndices.slice(i, i + 25);

      const destinations = chunk.map(d => `${d.lat},${d.lng}`).join('|');
      const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${group.origin.lat},${group.origin.lng}&destinations=${destinations}&mode=driving&key=${googleApiKey}`;

      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status !== 'OK' || !data.rows?.[0]?.elements) {
          console.error('Google Distance Matrix batch error:', data.status);
          return;
        }

        data.rows[0].elements.forEach((element: any, elemIdx: number) => {
          if (element.status === 'OK') {
            const rawKm = element.distance.value / 1000;
            const rounded = Math.ceil(rawKm * 10) / 10;
            results[chunkIndices[elemIdx]] = Math.max(0.1, rounded);
          }
        });
      } catch (error) {
        console.error('Google Distance Matrix batch API error:', error);
      }
    }
  });

  await Promise.all(apiCalls);
  return results;
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

    // Run independent queries in PARALLEL instead of sequentially
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [locationResult, completedResult, timingsResult, rejectionsResult] = await Promise.all([
      // Agent location
      supabase
        .from('driver_locations')
        .select('latitude, longitude')
        .eq('agent_id', agent_id)
        .eq('is_active', true)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Completed orders from delivery_history (source of truth)
      supabase
        .from('delivery_history')
        .select('order_id')
        .gte('completed_at', sevenDaysAgo),
      // Delivery timings
      supabase
        .from('delivery_timings')
        .select('*')
        .eq('is_active', true)
        .order('priority'),
      // Rejected orders for this agent
      supabase
        .from('agent_order_rejections')
        .select('order_id')
        .eq('agent_id', deliveryAgentId),
    ]);

    const agentLocation = locationResult.data;
    if (locationResult.error) console.warn('Failed to get agent location:', locationResult.error);

    const completedIds = new Set(completedResult.data?.map(c => c.order_id) || []);
    if (completedResult.error) console.warn('Failed to fetch completed orders:', completedResult.error);
    console.log(`[COMPLETION FILTER] Found ${completedIds.size} completed orders to exclude`);

    const deliveryTimings = timingsResult.data;
    const rejections = rejectionsResult.data;
    if (rejectionsResult.error) console.warn('Failed to fetch rejected orders:', rejectionsResult.error);
    console.log(`Agent ${deliveryAgentId} has ${rejections?.length || 0} rejected orders`);

    // STEP 2: Reassign stale orders
    const completedIdsList = Array.from(completedIds);
    
    const reassignQuery = supabase
      .from('orders')
      .update({ agent_id: null })
      .eq('status', 'packed')
      .is('subscription_id', null)
      .not('agent_id', 'is', null)
      .not('agent_id', 'eq', deliveryAgentId)
      .neq('payment_status', 'paid')
      .lt('updated_at', thirtyMinutesAgo);

    if (completedIdsList.length > 0) {
      reassignQuery.not('id', 'in', `(${completedIdsList.join(',')})`);
    }

    const { error: reassignError } = await reassignQuery;
    if (reassignError) console.warn('Failed to reassign stale orders:', reassignError);
    else console.log('✅ Reassigned stale orders');

    // STEP 3: Fetch orders
    const activeStatuses = ['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'payment_pending'];
    const terminalStatusesForQuery = ['delivered', 'completed', 'cancelled', 'canceled'];
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`*, delivery_time, delivery_time_slot, delivery_date, subscription_id`)
      .not('status', 'in', `(${terminalStatusesForQuery.join(',')})`)
      .gte('created_at', sevenDaysAgo)
      .or(`and(status.eq.packed,agent_id.is.null,assigned_agent_id.is.null),and(status.in.(${activeStatuses.join(',')}),or(agent_id.eq.${deliveryAgentId},assigned_agent_id.eq.${deliveryAgentId}))`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch orders:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch orders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Found ${orders?.length || 0} orders before filtering`);

    // Filter orders
    const terminalStatuses = ['delivered', 'completed', 'cancelled', 'canceled'];
    const activeStatusSet = new Set(['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'payment_pending']);
    
    let availableOrders = orders?.filter(order => {
      if (completedIds.has(order.id)) return false;
      const status = order.status?.toLowerCase();
      if (terminalStatuses.includes(status)) return false;
      const isOrphanedPaymentPending = order.status === 'payment_pending' && order.agent_id === null && order.assigned_agent_id === null;
      if (isOrphanedPaymentPending) return false;
      const isAvailable = order.agent_id === null && order.assigned_agent_id === null && order.status === 'packed';
      const isAgentOrder = (order.agent_id === deliveryAgentId || order.assigned_agent_id === deliveryAgentId) && activeStatusSet.has(order.status);
      return isAvailable || isAgentOrder;
    }) || [];

    // Filter rejected orders
    const rejectedOrderIds = new Set(rejections?.map(r => r.order_id) || []);
    let filteredOrders = availableOrders.filter(order => {
      if (order.agent_id === deliveryAgentId || order.assigned_agent_id === deliveryAgentId) return true;
      return !rejectedOrderIds.has(order.id);
    });

    // Filter seller-only orders IN PARALLEL
    const userOrdersResults = await Promise.all(
      filteredOrders.map(async (order) => {
        try {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', order.user_id);
          const hasSellerRole = userRoles?.some(ur => ur.role === 'seller') || false;
          const hasOtherRoles = userRoles?.some(ur => ur.role !== 'seller') || false;
          return hasSellerRole && !hasOtherRoles ? null : order;
        } catch {
          return order;
        }
      })
    );
    filteredOrders = userOrdersResults.filter(order => order !== null);

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
      console.log('Applying 10km radius filter with BATCHED distance calculation');

      // PHASE 1: Pre-compute delivery type and fetch seller info IN PARALLEL
      const orderMeta = await Promise.all(filteredOrders.map(async (order) => {
        const orderCreatedAt = new Date(order.created_at);
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const minutesSinceCreated = Math.floor((now.getTime() - orderCreatedAt.getTime()) / (1000 * 60));

        let calculatedType: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later' = 'immediate';
        let properTimeSlot = order.delivery_time_slot;
        let immediateTimingConfig = null;

        // Determine delivery type (same logic as before)
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
            properTimeSlot = scheduledTiming ? `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}` : '09:00-12:00';
          }
        } else if (order.delivery_time && order.delivery_time !== '12:00:00' && order.delivery_time.trim()) {
          calculatedType = 'scheduled';
        } else if (order.payment_status && order.payment_status.toLowerCase().includes('paid_subscription')) {
          calculatedType = 'subscription';
          if (!properTimeSlot) properTimeSlot = '06:00-10:00';
        } else if (
          !order.subscription_id &&
          (!order.delivery_time_slot || order.delivery_time_slot === null || order.delivery_time_slot === '' || order.delivery_time_slot.trim() === '') &&
          (!order.delivery_date || order.delivery_date === today) && 
          minutesSinceCreated < 45 &&
          (!order.delivery_time || order.delivery_time === '12:00:00')
        ) {
          calculatedType = 'immediate';
          const immediateTiming = deliveryTimings?.find(t => t.delivery_type === 'immediate');
          immediateTimingConfig = immediateTiming ? {
            max_duration_minutes: immediateTiming.max_duration_minutes,
            time_slot_start: immediateTiming.time_slot_start,
            time_slot_end: immediateTiming.time_slot_end,
            slot_name: immediateTiming.slot_name
          } : { max_duration_minutes: 20, time_slot_start: '00:00:00', time_slot_end: '23:59:59', slot_name: 'Immediate Delivery' };
        } else if (order.payment_status === 'pending') {
          calculatedType = 'book_now_pay_later';
        } else {
          calculatedType = 'scheduled';
          if (!properTimeSlot) {
            const scheduledTiming = deliveryTimings?.find(t => t.delivery_type === 'scheduled');
            properTimeSlot = scheduledTiming ? `${scheduledTiming.time_slot_start.slice(0, 5)}-${scheduledTiming.time_slot_end.slice(0, 5)}` : '09:00-12:00';
          }
        }

        // Fetch seller info
        let pickupLocation = null;
        let pickupAddress = null;
        let sellerName = null;
        let sellerPhone = null;

        if (order.items && order.items.length > 0) {
          const sellerId = order.items[0].seller_id;
          if (sellerId) {
            try {
              const { data: seller } = await supabase
                .from('sellers')
                .select('name, phone, latitude, longitude, address, business_name')
                .eq('user_id', sellerId)
                .single();
              if (seller && seller.latitude && seller.longitude) {
                pickupLocation = { lat: seller.latitude, lng: seller.longitude };
                pickupAddress = seller.address || `${seller.business_name || seller.name}`;
                sellerName = seller.business_name || seller.name;
                sellerPhone = seller.phone;
              }
            } catch {}
          }
        }

        const hasCoords = order.address?.coordinates?.lat && order.address?.coordinates?.lng;

        return { order, calculatedType, properTimeSlot, immediateTimingConfig, pickupLocation, pickupAddress, sellerName, sellerPhone, hasCoords };
      }));

      // PHASE 2: Build ALL distance pairs for batch Google API call
      const distancePairs: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }> = [];
      // Track which pair indices map to which order (agentToShop, shopToCustomer)
      const pairMapping: Array<{ orderIdx: number; type: 'agentToShop' | 'shopToCustomer' | 'direct' }> = [];

      orderMeta.forEach((meta, idx) => {
        if (!meta.hasCoords) return;
        const customerCoord = { lat: meta.order.address.coordinates.lat, lng: meta.order.address.coordinates.lng };

        if (meta.pickupLocation) {
          // Leg 1: Agent → Shop
          distancePairs.push({ origin: { lat: agentLocation.latitude, lng: agentLocation.longitude }, destination: meta.pickupLocation });
          pairMapping.push({ orderIdx: idx, type: 'agentToShop' });
          // Leg 2: Shop → Customer
          distancePairs.push({ origin: meta.pickupLocation, destination: customerCoord });
          pairMapping.push({ orderIdx: idx, type: 'shopToCustomer' });
        } else {
          // Direct: Agent → Customer
          distancePairs.push({ origin: { lat: agentLocation.latitude, lng: agentLocation.longitude }, destination: customerCoord });
          pairMapping.push({ orderIdx: idx, type: 'direct' });
        }
      });

      console.log(`📦 Batching ${distancePairs.length} distance calculations for ${orderMeta.length} orders (was ${distancePairs.length} sequential API calls before)`);

      // PHASE 3: Single batched API call instead of 2N sequential calls
      const batchResults = await batchCalculateRoadDistances(distancePairs);

      // PHASE 4: Assemble results
      const orderDistances = new Map<number, { agentToShop: number | null; shopToCustomer: number | null }>();
      pairMapping.forEach((mapping, pairIdx) => {
        if (!orderDistances.has(mapping.orderIdx)) {
          orderDistances.set(mapping.orderIdx, { agentToShop: null, shopToCustomer: null });
        }
        const entry = orderDistances.get(mapping.orderIdx)!;
        if (mapping.type === 'agentToShop') entry.agentToShop = batchResults[pairIdx];
        else if (mapping.type === 'shopToCustomer') entry.shopToCustomer = batchResults[pairIdx];
        else { entry.agentToShop = batchResults[pairIdx]; entry.shopToCustomer = batchResults[pairIdx]; }
      });

      const nearbyOrders: any[] = [];
      orderMeta.forEach((meta, idx) => {
        if (!meta.hasCoords) return;
        const distances = orderDistances.get(idx);
        if (!distances || distances.agentToShop === null || distances.shopToCustomer === null) return;

        const totalDistance = distances.agentToShop + distances.shopToCustomer;
        if (totalDistance > 10) {
          console.log(`❌ Order ${meta.order.id} too far: ${totalDistance}km > 10km`);
          return;
        }

        const payoutDistance = Math.max(0.1, distances.shopToCustomer);
        const agentPayout = calculateAgentPayout(payoutDistance);
        const estimatedTime = Math.max(5, Math.ceil(payoutDistance * 2));

        nearbyOrders.push({
          ...meta.order,
          distance_km: payoutDistance,
          agent_to_shop_distance: distances.agentToShop,
          total_distance: totalDistance,
          agent_payout: agentPayout,
          estimated_delivery_time: estimatedTime,
          backend_calculated: true,
          road_distance: true,
          pickup_location: meta.pickupLocation,
          pickup_address: meta.pickupAddress,
          pickup_status: 'pending',
          seller_name: meta.sellerName,
          seller_phone: meta.sellerPhone,
          calculated_delivery_type: meta.calculatedType,
          delivery_type: meta.calculatedType,
          delivery_time_slot: meta.properTimeSlot || meta.order.delivery_time_slot,
          original_created_at: meta.order.created_at,
          immediate_timing_config: meta.immediateTimingConfig,
          payout_breakdown: {
            base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
            distance_pay: Math.round((payoutDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE) * 10) / 10,
            distance_km: payoutDistance,
            rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE
          }
        });
      });

      filteredOrders = nearbyOrders;
      console.log(`After 10km filtering with BATCHED road distance: ${filteredOrders.length} orders remain`);
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
