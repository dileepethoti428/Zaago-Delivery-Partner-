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
    console.log('🔍 QR Scan Request started');
    
    const body = await req.json();
    const { qr_code_data } = body;

    console.log('📱 QR Code data received:', qr_code_data);

    if (!qr_code_data) {
      console.error('❌ No QR code data provided');
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
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required - no authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🎫 Token extracted, length:', token.length);
    
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed: ' + authError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    if (!userData.user) {
      console.error('❌ No user data found');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required - no user found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', userData.user.email);

    // Get agent info
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', userData.user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Validate QR code and get order details with agent assignment
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
          delivery_time_slot,
          agent_id
        )
      `)
      .eq('qr_code_data', qr_code_data)
      .single();

    if (qrError || !qrData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid QR code. Please ensure you are scanning a valid delivery QR code.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const order = qrData.orders as any;

    // Check if order exists
    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found for this QR code.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If order already delivered, show completion status
    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'already_delivered',
          message: 'This order has already been delivered',
          order: {
            id: order.id,
            customer_name: order.customer_name,
            total: order.total,
            payment_status: order.payment_status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is assigned to this agent
    if (order.agent_id !== agent.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order is not assigned to you',
          message: 'This order is assigned to another delivery agent. Only the assigned agent can complete this delivery.',
          details: {
            order_id: order.id.substring(0, 8),
            customer: order.customer_name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Check if order is ready for delivery
    if (order.status !== 'assigned') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not ready for delivery',
          message: `Order status is '${order.status}'. Only orders with 'assigned' status can be delivered.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If QR already scanned, prevent re-scanning
    if (qrData.is_scanned) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'QR code already used',
          message: 'This QR code has already been scanned. Each QR code can only be used once.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate estimated payout
    let estimated_payout = 12; // Base rate fallback
    try {
      const { data: calculationData } = await supabaseClient.rpc('calculate_delivery_payout', {
        p_distance_km: 2.5, // Estimated distance
        p_delivery_time: new Date().toISOString(),
        p_agent_id: agent.id
      });
      
      if (calculationData?.total_payout) {
        estimated_payout = calculationData.total_payout;
      }
    } catch (error) {
      console.warn('Payout calculation failed, using default:', error);
    }

    // Return order details with payment method options
    return new Response(
      JSON.stringify({
        success: true,
        status: 'ready_for_delivery',
        message: 'Order ready for delivery. Please select payment method.',
        order: {
          id: order.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          address: order.address,
          items: order.items,
          total: order.total,
          special_instructions: order.special_instructions,
          delivery_time_slot: order.delivery_time_slot,
          estimated_payout
        },
        payment_options: [
          {
            value: 'COD',
            label: 'Cash on Delivery (COD)',
            description: 'Customer pays cash upon delivery'
          },
          {
            value: 'Online',
            label: 'Online Payment',
            description: 'Customer has already paid online'
          }
        ],
        agent: {
          name: agent.name,
          id: agent.id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('QR Scan Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to process QR scan. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});