import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { qr_code_data, payment_method = 'prepaid' } = await req.json();

    if (!qr_code_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR code data is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get agent info
    const { data: agent } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Validate QR code and get order details
    const { data: qrData, error: qrError } = await supabaseClient
      .from('order_qr_codes')
      .select(`
        order_id,
        is_scanned,
        orders (
          id,
          customer_name,
          customer_phone,
          address,
          items,
          total,
          status,
          payment_status,
          special_instructions,
          delivery_time_slot
        )
      `)
      .eq('qr_code_data', qr_code_data)
      .single();

    if (qrError || !qrData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (qrData.is_scanned) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR code already used' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const order = qrData.orders as any;
    if (!order || order.status !== 'assigned') {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not ready for delivery' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Mark QR as scanned
    const { error: scanUpdateError } = await supabaseClient
      .from('order_qr_codes')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        // Use delivery agent's id to satisfy FK (not auth user id)
        scanned_by: agent.id
      })
      .eq('qr_code_data', qr_code_data);

    if (scanUpdateError) {
      console.error('Failed to mark QR as scanned:', scanUpdateError);
      // Continue; do not block delivery completion on QR update issues
    }

    // Update order status to delivered
    await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online'
      })
      .eq('id', order.id);

    // Create delivery history record with distance data
    await supabaseClient
      .from('delivery_history')
      .insert({
        order_id: order.id,
        agent_id: agent.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        delivery_address: order.address,
        items: order.items,
        total_amount: order.total,
        payment_method: payment_method,
        payment_status: payment_method === 'COD' ? 'paid_cod' : 'paid_online',
        delivery_date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
        special_instructions: order.special_instructions,
        delivery_time_slot: order.delivery_time_slot,
        delivery_notes: `Completed via QR scan by ${agent.name}`,
        distance_traveled: 2.5, // Default distance - could be enhanced to get actual distance
        delivery_payout: 27.5 // Base pay + distance pay (15 + 12.5 for 1.5km extra)
      });

    // Calculate and process payout
    try {
      const { data: payoutData } = await supabaseClient.functions.invoke('calculate-delivery-payout', {
        body: {
          distance_km: 2.5, // Default distance - could be enhanced to get actual
          delivery_time: new Date().toISOString(),
          agent_id: agent.id
        }
      });

      if (payoutData?.total_payout) {
        // Create earnings record with proper status
        await supabaseClient
          .from('earnings')
          .insert({
            agent_id: agent.id,
            order_id: order.id,
            amount: payoutData.total_payout,
            status: 'completed', // Using 'completed' as valid status
            distance_km: 2.5,
            payment_method: payment_method === 'COD' ? 'COD' : 'Online',
            description: `Delivery payout for order ${order.id.substring(0, 8)}`
          });
      }
    } catch (payoutError) {
      console.error('Payout processing failed:', payoutError);
      // Continue execution - don't fail delivery for payout issues
    }

    // Update agent statistics - get current values first
    const { data: currentAgent } = await supabaseClient
      .from('delivery_agents')
      .select('total_deliveries, deliveries_today, total_earnings')
      .eq('id', agent.id)
      .single();

    if (currentAgent) {
      await supabaseClient
        .from('delivery_agents')
        .update({
          total_deliveries: (currentAgent.total_deliveries || 0) + 1,
          deliveries_today: (currentAgent.deliveries_today || 0) + 1,
          total_earnings: (currentAgent.total_earnings || 0) + order.total,
          last_delivery_at: new Date().toISOString()
        })
        .eq('id', agent.id);
    }

    // Create order tracking record
    await supabaseClient
      .from('order_tracking')
      .insert({
        order_id: order.id,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        location: order.address?.coordinates || null,
        notes: `Order delivered via QR scan by ${agent.name}`
      });

      // Get order details from orders table to get user_id
      const { data: orderData } = await supabaseClient
        .from('orders')
        .select('user_id')
        .eq('id', order.id)
        .single();

      // Create notifications for seller, admin, and customer
      try {
        // Notify customer
        if (orderData?.user_id) {
          await supabaseClient
            .from('notifications')
            .insert({
              user_id: orderData.user_id,
              title: 'Order Delivered',
              message: `Your order #${order.id.substring(0, 8)} has been delivered successfully by ${agent.name}`,
              type: 'delivery_completed',
              role: 'user',
              order_id: order.id
            });
        }

        // Notify seller (if order has seller products)
        const { data: orderItems } = await supabaseClient
          .from('order_items')
          .select('product_id, products(seller_id)')
          .eq('order_id', order.id);

        if (orderItems && orderItems.length > 0) {
          const sellerIds = [...new Set(orderItems.map(item => item.products?.seller_id).filter(Boolean))];
          
          for (const sellerId of sellerIds) {
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: sellerId,
                title: 'Order Delivered',
                message: `Order #${order.id.substring(0, 8)} for ${order.customer_name} has been delivered`,
                type: 'order_delivered',
                role: 'seller',
                order_id: order.id
              });
          }
        }

        // Notify admin
        const { data: admins } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await supabaseClient
              .from('notifications')
              .insert({
                user_id: admin.user_id,
                title: 'Delivery Completed',
                message: `Agent ${agent.name} completed delivery for order #${order.id.substring(0, 8)}`,
                type: 'delivery_completed',
                role: 'admin',
                order_id: order.id
              });
          }
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
        // Don't fail the delivery for notification issues
      }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order completed successfully!',
        order: {
          id: order.id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('QR Complete Delivery Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});