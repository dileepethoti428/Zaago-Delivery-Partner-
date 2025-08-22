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
    await supabaseClient
      .from('order_qr_codes')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        scanned_by: user.id
      })
      .eq('qr_code_data', qr_code_data);

    // Update order status to delivered
    await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: payment_method === 'COD' ? 'cash_collected' : order.payment_status
      })
      .eq('id', order.id);

    // Create delivery history record
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
        payment_status: payment_method === 'COD' ? 'cash_collected' : 'prepaid',
        delivery_date: new Date().toISOString().split('T')[0],
        completed_at: new Date().toISOString(),
        special_instructions: order.special_instructions,
        delivery_time_slot: order.delivery_time_slot,
        delivery_notes: `Completed via QR scan by ${agent.name}`
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
        await supabaseClient.functions.invoke('process-delivery-payout', {
          body: {
            agent_id: agent.id,
            order_id: order.id,
            payout_amount: payoutData.total_payout,
            breakdown: payoutData
          }
        });
      }
    } catch (payoutError) {
      console.error('Payout processing failed:', payoutError);
      // Continue execution - don't fail delivery for payout issues
    }

    // Update agent statistics
    await supabaseClient
      .from('delivery_agents')
      .update({
        total_deliveries: supabaseClient.raw('total_deliveries + 1'),
        deliveries_today: supabaseClient.raw('deliveries_today + 1'),
        total_earnings: supabaseClient.raw(`total_earnings + ${order.total}`),
        last_delivery_at: new Date().toISOString()
      })
      .eq('id', agent.id);

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