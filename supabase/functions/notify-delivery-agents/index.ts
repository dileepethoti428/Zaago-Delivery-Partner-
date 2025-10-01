import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      console.log('Mapbox failed, using fallback:', mapboxError instanceof Error ? mapboxError.message : 'Unknown error');
      return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    }
  } else {
    return calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { order_id, status, customer_name, total_amount } = await req.json()
    
    console.log('📦 Notify agents called for order:', order_id, 'Status:', status)
    
    // CRITICAL VALIDATION: Check order state before sending notifications
    const { data: orderCheck, error: orderCheckError } = await supabase
      .from('orders')
      .select('id, status, agent_id, delivered_at, updated_at')
      .eq('id', order_id)
      .single()
    
    if (orderCheckError) {
      console.error('Error checking order state:', orderCheckError)
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    
    // Don't notify if order already has an agent assigned
    if (orderCheck.agent_id) {
      console.log('⚠️ Order already assigned to agent:', orderCheck.agent_id)
      return new Response(
        JSON.stringify({ message: 'Order already assigned', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Don't notify if order is already delivered
    if (orderCheck.status === 'delivered' || orderCheck.delivered_at) {
      console.log('⚠️ Order already delivered')
      return new Response(
        JSON.stringify({ message: 'Order already delivered', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Don't notify if order is not in packed status (for packed notifications)
    if (status === 'packed' && orderCheck.status !== 'packed') {
      console.log('⚠️ Order status mismatch. Expected packed, got:', orderCheck.status)
      return new Response(
        JSON.stringify({ message: 'Order status mismatch', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Don't notify for stale orders (older than 24 hours)
    const orderAge = Date.now() - new Date(orderCheck.updated_at).getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (orderAge > twentyFourHours) {
      console.log('⚠️ Order too old:', Math.floor(orderAge / (60 * 60 * 1000)), 'hours')
      return new Response(
        JSON.stringify({ message: 'Order too old', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Order validation passed - proceeding with notifications')
    
    // Get all active agents with their locations
    const { data: agents, error: agentsError } = await supabase
      .from('delivery_agents')
      .select('id, name, email, onesignal_player_id')
      .eq('is_active', true)
    
    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
      throw agentsError
    }
    
    console.log(`Found ${agents?.length || 0} active agents before distance filtering`)
    
    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active agents to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get seller location (pickup point) from order
    let sellerLocation = null;
    try {
      const { data: seller } = await supabase
        .from('sellers')
        .select('latitude, longitude')
        .eq('user_id', orderCheck.user_id)
        .maybeSingle();
      
      if (seller?.latitude && seller?.longitude) {
        sellerLocation = { lat: seller.latitude, lng: seller.longitude };
        console.log('Seller location found:', sellerLocation);
      }
    } catch (err) {
      console.warn('Failed to get seller location:', err);
    }
    
    // Get customer delivery location from order
    let customerLocation = null;
    try {
      if (orderCheck.delivery_address) {
        const address = typeof orderCheck.delivery_address === 'string' 
          ? JSON.parse(orderCheck.delivery_address) 
          : orderCheck.delivery_address;
        
        if (address?.coordinates) {
          customerLocation = {
            lat: address.coordinates.lat || address.coordinates.latitude,
            lng: address.coordinates.lng || address.coordinates.longitude
          };
          console.log('Customer location found:', customerLocation);
        }
      }
    } catch (err) {
      console.warn('Failed to parse delivery address:', err);
    }
    
    // Filter agents by 15km distance if we have location data
    let nearbyAgents = agents;
    
    if (sellerLocation && customerLocation) {
      console.log('🔍 Filtering agents by 15km distance...');
      
      // Get agent locations from driver_locations table
      const { data: agentLocations } = await supabase
        .from('driver_locations')
        .select('agent_id, latitude, longitude')
        .eq('is_active', true)
        .in('agent_id', agents.map(a => a.id));
      
      const agentLocationMap = new Map(
        agentLocations?.map(loc => [loc.agent_id, { lat: loc.latitude, lng: loc.longitude }]) || []
      );
      
      // Filter agents based on total distance (agent → seller → customer)
      const distanceChecks = await Promise.all(
        agents.map(async (agent) => {
          const agentLoc = agentLocationMap.get(agent.id);
          
          if (!agentLoc) {
            console.log(`Agent ${agent.id} has no location data - excluding from notifications`);
            return null;
          }
          
          try {
            // Calculate: Agent → Seller (pickup)
            const agentToSeller = await calculateDistance(agentLoc, sellerLocation);
            
            // Calculate: Seller → Customer (delivery)
            const sellerToCustomer = await calculateDistance(sellerLocation, customerLocation);
            
            const totalDistance = agentToSeller + sellerToCustomer;
            
            console.log(`Agent ${agent.name}: ${totalDistance.toFixed(2)}km total (${agentToSeller.toFixed(2)}km to pickup + ${sellerToCustomer.toFixed(2)}km to delivery)`);
            
            if (totalDistance <= 15) {
              return { agent, distance: totalDistance };
            }
            
            return null;
          } catch (err) {
            console.warn(`Failed to calculate distance for agent ${agent.id}:`, err);
            return null;
          }
        })
      );
      
      nearbyAgents = distanceChecks
        .filter(result => result !== null)
        .map(result => result!.agent);
      
      console.log(`✅ ${nearbyAgents.length} agents within 15km range`);
    } else {
      console.warn('⚠️ Missing location data - notifying all agents (location: seller=%s, customer=%s)', 
        !!sellerLocation, !!customerLocation);
    }
    
    if (nearbyAgents.length === 0) {
      console.log('❌ No agents within 15km range');
      return new Response(
        JSON.stringify({ 
          message: 'No agents within delivery range',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`📤 Sending notifications to ${nearbyAgents.length} nearby agents`)
    
    // Create agent notifications for immediate response - use 'system' type to avoid constraint violation
    const notifications = nearbyAgents.map(agent => ({
      agent_id: agent.id,
      type: 'system', // Use system instead of order_packed to avoid constraint violation
      title: status === 'packed' ? '🚨 Order Packed & Ready!' : '📦 New Order Available',
      message: status === 'packed' 
        ? `Order from ${customer_name || 'customer'} has been packed and is ready for pickup`
        : `New order from ${customer_name || 'customer'} for ₹${total_amount || 0}`,
      source_type: 'system',
      source_id: order_id,
      metadata: {
        notification_subtype: status === 'packed' ? 'order_packed' : 'order_available', // Keep the actual type in metadata
        order_id,
        status,
        customer_name,
        total_amount,
        notification_time: new Date().toISOString(),
        priority: status === 'packed' ? 'high' : 'normal'
      },
      read: false
    }))
    
    // Insert notifications
    const { error: notificationError } = await supabase
      .from('agent_notifications')
      .insert(notifications)
    
    if (notificationError) {
      console.error('Error creating notifications:', notificationError)
      throw notificationError
    }
    
    // Send single real-time broadcast to all agents at once (more efficient)
    const channel = supabase.channel('orders-realtime-updates')
    
    await channel.send({
      type: 'broadcast',
      event: 'urgent_notification',
      payload: {
        type: 'urgent_notification',
        notification_type: status === 'packed' ? 'order_packed' : 'order_available',
        order_id,
        status,
        customer_name,
        total_amount,
        priority: status === 'packed' ? 'high' : 'normal',
        timestamp: new Date().toISOString(),
        agents_count: nearbyAgents.length,
        title: status === 'packed' ? '🚨 Order Packed & Ready!' : '📦 New Order Available',
        message: status === 'packed' 
          ? `Order from ${customer_name || 'customer'} has been packed and is ready for pickup`
          : `New order from ${customer_name || 'customer'} for ₹${total_amount || 0}`
      }
    })
    
    console.log(`📡 Real-time broadcast sent for ${status} order ${order_id}`)
    
    // Update order notification sent flag
    await supabase
      .from('orders')
      .update({ 
        agent_notification_sent: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
    
    console.log(`✅ Successfully notified ${nearbyAgents.length} nearby agents for order ${order_id}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notified ${nearbyAgents.length} agents within 15km range`,
        agents_notified: nearbyAgents.length,
        total_active_agents: agents.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in notify-delivery-agents:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})