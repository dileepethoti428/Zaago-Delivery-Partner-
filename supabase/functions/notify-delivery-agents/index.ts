import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Get all active agents (both online and offline - they should get notifications)
    const { data: agents, error: agentsError } = await supabase
      .from('delivery_agents')
      .select('id, name, email, onesignal_player_id')
      .eq('is_active', true)
    
    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
      throw agentsError
    }
    
    console.log(`Found ${agents?.length || 0} active agents to notify`)
    
    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active agents to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create agent notifications for immediate response - use 'system' type to avoid constraint violation
    const notifications = agents.map(agent => ({
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
        agents_count: agents.length,
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
    
    console.log(`✅ Successfully notified ${agents.length} agents for order ${order_id}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notified ${agents.length} agents`,
        agents_notified: agents.length
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