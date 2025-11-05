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
    
    const { order_id, marked_by } = await req.json()
    
    console.log('📦 Mark order as packed called for order:', order_id, 'by:', marked_by)
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if this is a test order (for audio testing)
    const isTestOrder = order_id === '550e8400-e29b-41d4-a716-446655440000'
    
    let order
    
    if (isTestOrder) {
      console.log('🧪 Test order detected - using mock data for audio testing')
      // Create mock order data for testing
      order = {
        id: order_id,
        customer_name: 'Test Customer',
        total: 150.00,
        status: 'confirmed',
        agent_id: null
      }
    } else {
      // First, get the order details from database (including location data)
      const { data: dbOrder, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_name, total, status, agent_id, pickup_address, pickup_location, delivery_address_id')
        .eq('id', order_id)
        .single()

      if (orderError || !dbOrder) {
        console.error('Error fetching order:', orderError)
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      order = dbOrder
      
      // Validate location data exists before allowing packing
      const hasPickupLocation = order.pickup_address || order.pickup_location
      const hasDeliveryAddress = order.delivery_address_id
      
      if (!hasPickupLocation || !hasDeliveryAddress) {
        console.error('❌ Order missing location data:', {
          has_pickup: !!hasPickupLocation,
          has_delivery: !!hasDeliveryAddress
        })
        return new Response(
          JSON.stringify({ 
            error: 'Cannot mark as packed: Order is missing required location data',
            details: {
              missing_pickup: !hasPickupLocation,
              missing_delivery: !hasDeliveryAddress
            }
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    console.log('📋 Order details:', order)

    // Update order status to packed (skip for test orders)
    if (!isTestOrder) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'packed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)

      if (updateError) {
        console.error('Error updating order status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update order status' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log('✅ Order status updated to packed')
    } else {
      console.log('🧪 Skipping database update for test order')
    }

    // Immediately notify all delivery agents about the packed order
    try {
      console.log('🚨 Calling notify-delivery-agents for immediate notification...')
      
      const { data: notifyResult, error: notifyError } = await supabase.functions.invoke('notify-delivery-agents', {
        body: {
          order_id: order.id,
          status: 'packed',
          customer_name: order.customer_name,
          total_amount: order.total
        }
      })

      if (notifyError) {
        console.error('⚠️ Error calling notify-delivery-agents:', notifyError)
        // Don't fail the main operation if notification fails
      } else {
        console.log('✅ Successfully notified delivery agents:', notifyResult)
      }
    } catch (notifyErr) {
      console.error('⚠️ Exception calling notify-delivery-agents:', notifyErr)
      // Don't fail the main operation if notification fails
    }

    // Create admin log entry
    try {
      await supabase
        .from('password_reset_logs')
        .insert({
          email: marked_by || 'system@zaago.com',
          event_type: 'email_sent',
          metadata: {
            action: 'order_marked_as_packed',
            order_id: order.id,
            customer_name: order.customer_name,
            total_amount: order.total,
            marked_by: marked_by,
            timestamp: new Date().toISOString()
          }
        })
    } catch (logError) {
      console.error('⚠️ Error creating log entry:', logError)
      // Don't fail the main operation if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: isTestOrder ? 'Test notification sent successfully!' : 'Order marked as packed and agents notified',
        order_id: order.id,
        notifications_sent: true,
        test_mode: isTestOrder
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in mark-order-as-packed:', error)
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