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
    
    // Get all active agents
    const { data: agents, error: agentsError } = await supabase
      .from('delivery_agents')
      .select('id, name, email, onesignal_player_id')
      .eq('is_active', true)
      .eq('is_online', true)
    
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
    
    // Create agent notifications for immediate response
    const notifications = agents.map(agent => ({
      agent_id: agent.id,
      type: status === 'packed' ? 'order_packed' : 'order_available',
      title: status === 'packed' ? '🚨 Order Packed & Ready!' : '📦 New Order Available',
      message: status === 'packed' 
        ? `Order from ${customer_name || 'customer'} has been packed and is ready for pickup`
        : `New order from ${customer_name || 'customer'} for ₹${total_amount || 0}`,
      source_type: 'system',
      source_id: order_id,
      metadata: {
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
    
    // Send real-time broadcast for immediate frontend response
    const channel = supabase.channel('agent-notifications')
    
    for (const agent of agents) {
      await channel.send({
        type: 'broadcast',
        event: 'urgent_notification',
        payload: {
          agent_id: agent.id,
          order_id,
          status,
          customer_name,
          total_amount,
          notification_type: status === 'packed' ? 'order_packed' : 'order_available',
          priority: status === 'packed' ? 'high' : 'normal',
          timestamp: new Date().toISOString()
        }
      })
    }
    
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})