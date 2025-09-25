
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
    // Enhanced request body parsing with better error handling
    let body;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      console.log('Raw request body:', rawBody);
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(rawBody);
      console.log('Parsed request body:', body);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw body that failed to parse:', rawBody);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format. Please ensure request body is valid JSON.',
          details: `JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          received_body: rawBody
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id, agent_location } = body;
    let { payment_method } = body;
    
    // Enhanced payment method validation and sanitization
    if (!payment_method || typeof payment_method !== 'string') {
      console.log('Invalid payment_method received, defaulting to Online:', payment_method);
      payment_method = 'Online';
    } else {
      // Clean the payment method string
      payment_method = payment_method.toString().trim();
    }
    
    // Ensure payment_method is one of the expected values
    const validPaymentMethods = ['Online', 'COD', 'UPI', 'Card'];
    if (!validPaymentMethods.includes(payment_method)) {
      console.log(`Invalid payment method "${payment_method}", defaulting to Online`);
      payment_method = 'Online';
    }
    
    console.log('Complete delivery request validated:', { order_id, payment_method, agent_location });

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
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
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

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

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if order is already delivered
    if (order.status === 'delivered') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already delivered' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance first (before any database operations)
    // Use shop location (Bangalore coordinates) to customer address for consistent delivery distance
    let distance_km = 2.0;
    let payout_amount = 35;

    if (order.address?.coordinates) {
      try {
        // Use shop coordinates (same as Home page for consistency)
        const shopLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore coordinates
        
        const { data: distanceData } = await supabaseClient.functions.invoke('calculate-distance-eta', {
          body: {
            origin: shopLocation,
            destination: order.address.coordinates
          }
        });

        if (distanceData?.distance_km) {
          distance_km = distanceData.distance_km;
          // Calculate payout based on real distance: ₹20 base + ₹15/km beyond 1km
          payout_amount = distance_km <= 1 ? 20 : 20 + (distance_km - 1) * 15;
        }
      } catch (distanceError) {
        console.error('Distance calculation failed:', distanceError);
      }
    }

    // Check if delivery is late and send apology if needed
    const { data: orderData } = await supabaseClient
      .from('orders')
      .select('delivery_time_slot, delivery_date, customer_name, customer_phone, created_at')
      .eq('id', order_id)
      .single();

    let isLateDelivery = false;
    let delayMinutes = 0;

    if (orderData?.delivery_time_slot && orderData?.delivery_date) {
      // Parse scheduled delivery time
      const scheduledTime = new Date(`${orderData.delivery_date}T${orderData.delivery_time_slot.split('-')[1]}:00`);
      const currentTime = new Date();
      
      if (currentTime > scheduledTime) {
        isLateDelivery = true;
        delayMinutes = Math.floor((currentTime.getTime() - scheduledTime.getTime()) / (1000 * 60));
      }
    } else if (orderData?.created_at) {
      // For immediate deliveries, check if more than 30 minutes have passed since order creation
      const orderTime = new Date(orderData.created_at);
      const currentTime = new Date();
      const minutesSinceOrder = Math.floor((currentTime.getTime() - orderTime.getTime()) / (1000 * 60));
      
      if (minutesSinceOrder > 30) {
        isLateDelivery = true;
        delayMinutes = minutesSinceOrder - 30; // Minutes beyond expected 30 min delivery
      }
    }

    // STEP 1: DETAILED DATA INSPECTION
    console.log('=== DEBUGGING: Order Data Inspection ===');
    console.log('Order ID:', order_id);
    console.log('Order status:', order.status);
    console.log('Order address type:', typeof order.address);
    console.log('Order address value:', order.address);
    console.log('Order items type:', typeof order.items);
    console.log('Order items value:', order.items);
    console.log('Order pickup_location type:', typeof order.pickup_location);
    console.log('Order pickup_location value:', order.pickup_location);
    console.log('Order pickup_address type:', typeof order.pickup_address);
    console.log('Order pickup_address value:', order.pickup_address);
    console.log('Order special_instructions:', order.special_instructions);
    console.log('Full order object keys:', Object.keys(order));
    
    // Check for any problematic fields
    let hasProblematicData = false;
    const problematicFields = [];
    
    if (order.pickup_address && typeof order.pickup_address === 'string' && order.pickup_address.includes('Peak')) {
      hasProblematicData = true;
      problematicFields.push('pickup_address contains "Peak"');
    }
    
    if (order.address && typeof order.address === 'string') {
      hasProblematicData = true;
      problematicFields.push('address is string instead of JSONB');
    }
    
    if (order.items && typeof order.items === 'string') {
      hasProblematicData = true;
      problematicFields.push('items is string instead of JSONB');
    }
    
    if (hasProblematicData) {
      console.error('=== PROBLEMATIC DATA DETECTED ===');
      console.error('Problematic fields:', problematicFields);
      console.error('This order needs data cleanup before processing');
    }

    // STEP 2: PRE-UPDATE DATA PREPARATION WITH VALIDATION
    console.log('=== DEBUGGING: Preparing update data ===');
    
    const deliveredAt = new Date().toISOString();
    const paymentStatus = payment_method === 'COD' ? 'paid_cod' : 'paid_online';
    
    const updateData = {
      status: 'delivered',
      delivered_at: deliveredAt,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };
    
    console.log('Update data prepared:', updateData);
    console.log('Update data JSON:', JSON.stringify(updateData));
    
    // STEP 3: ATTEMPT DATABASE UPDATE WITH DETAILED ERROR HANDLING
    console.log('=== DEBUGGING: Starting database update ===');
    console.log('Updating order status for order:', order_id);
    
    let updateResult, updateError;
    
    try {
      const result = await supabaseClient
        .from('orders')
        .update(updateData)
        .eq('id', order_id)
        .select('id, status, delivered_at, payment_status');
      
      updateResult = result.data;
      updateError = result.error;
      
      console.log('Database update completed');
      console.log('Update result:', updateResult);
      console.log('Update error:', updateError);
      
    } catch (dbError) {
      console.error('=== DATABASE UPDATE EXCEPTION ===');
      console.error('Exception type:', typeof dbError);
      console.error('Exception message:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('Exception stack:', dbError instanceof Error ? dbError.stack : 'No stack');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database update exception occurred', 
          details: dbError instanceof Error ? dbError.message : String(dbError),
          debug_info: { 
            order_id, 
            payment_method,
            update_data: updateData,
            exception_type: typeof dbError
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (updateError) {
      console.error('=== DATABASE UPDATE ERROR ===');
      console.error('Error object:', updateError);
      console.error('Error message:', updateError.message);
      console.error('Error code:', updateError.code);
      console.error('Error details:', updateError.details);
      console.error('Error hint:', updateError.hint);
      console.error('Order ID that failed:', order_id);
      console.error('Update data that failed:', updateData);
      
      // Check if this is the specific JSON error we've been seeing
      if (updateError.message?.includes('invalid input syntax for type json')) {
        console.error('=== JSON SYNTAX ERROR DETECTED ===');
        console.error('This is the JSON parsing error we have been debugging');
        console.error('The error details suggest corrupted JSON data in the database');
        
        // Try to identify which field is causing the issue
        if (updateError.details?.includes('Peak')) {
          console.error('The error is related to "Peak" token - likely in pickup_address field');
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Database contains corrupted JSON data', 
            details: 'Order contains invalid JSON data that prevents updates. Admin intervention required.',
            debug_info: { 
              order_id, 
              error_type: 'json_corruption',
              error_message: updateError.message,
              error_code: updateError.code,
              error_details: updateError.details,
              problematic_fields: problematicFields.length > 0 ? problematicFields : 'none detected in initial scan'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update order status', 
          details: updateError.message,
          debug_info: { 
            order_id, 
            payment_method, 
            error_code: updateError.code,
            error_details: updateError.details,
            error_hint: updateError.hint,
            update_data: updateData
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    console.log('Order status updated successfully');

    // Send apology message if delivery is late
    if (isLateDelivery && orderData?.customer_phone && orderData?.customer_name && delayMinutes > 5) {
      try {
        const { error: apologyError } = await supabaseClient.functions.invoke('send-apology-message', {
          body: {
            order_id,
            customer_phone: orderData.customer_phone,
            customer_name: orderData.customer_name,
            delay_minutes: delayMinutes
          }
        });

        if (apologyError) {
          console.warn('Failed to send apology message:', apologyError);
        } else {
          console.log(`Apology message sent for late delivery: ${delayMinutes} minutes delay`);
        }
      } catch (apologyError) {
        console.warn('Error sending apology message:', apologyError);
      }
    }

    // STEP 4: COD SETTLEMENT WITH DEBUGGING
    let codSettlementResult = null;
    if (payment_method === 'COD') {
      console.log('=== DEBUGGING: COD Settlement Process ===');
      console.log('Processing COD settlement for agent:', agent.id);
      console.log('Order total:', order.total);
      
      try {
        console.log('Calling settle_cod_automatically RPC...');
        const { data: settlementData, error: settlementError } = await supabaseClient.rpc('settle_cod_automatically', {
          p_agent_id: agent.id,
          p_order_id: order_id,
          p_cod_amount: order.total
        });

        console.log('COD RPC completed');
        console.log('Settlement data:', settlementData);
        console.log('Settlement error:', settlementError);

        if (settlementError) {
          console.error('=== COD SETTLEMENT ERROR ===');
          console.error('Settlement error object:', settlementError);
          console.error('Settlement error message:', settlementError.message);
          console.error('Settlement error code:', settlementError.code);
          console.error('Settlement error details:', settlementError.details);
        } else {
          codSettlementResult = settlementData;
          console.log('COD settlement successful:', settlementData);
        }
      } catch (error) {
        console.error('=== COD SETTLEMENT EXCEPTION ===');
        console.error('COD settlement exception:', error);
        console.error('Exception type:', typeof error);
        console.error('Exception message:', error instanceof Error ? error.message : String(error));
      }
    }

    // STEP 5: PAYOUT PROCESSING WITH DEBUGGING
    let payoutResult = null;
    console.log('=== DEBUGGING: Payout Processing ===');
    console.log('Processing payout for agent:', agent.id);
    console.log('Distance:', distance_km, 'km');
    console.log('Expected payout amount:', payout_amount);
    
    try {
      console.log('Calling process_delivery_payout_safe RPC...');
      const { data: payoutData, error: payoutError } = await supabaseClient.rpc('process_delivery_payout_safe', {
        p_agent_id: agent.id,
        p_order_id: order_id,
        p_distance_km: distance_km,
        p_delivery_time: new Date().toISOString()
      });

      console.log('Payout RPC completed');
      console.log('Payout data:', payoutData);
      console.log('Payout error:', payoutError);

      if (payoutError) {
        console.error('=== PAYOUT PROCESSING ERROR ===');
        console.error('Payout error object:', payoutError);
        console.error('Payout error message:', payoutError.message);
        console.error('Payout error code:', payoutError.code);
        console.error('Payout error details:', payoutError.details);
      } else {
        payoutResult = payoutData;
        if (payoutResult?.payout_details?.total_payout) {
          payout_amount = payoutResult.payout_details.total_payout;
        }
        console.log('Payout processing successful:', payoutResult);
        console.log('Final payout amount:', payout_amount);
      }
    } catch (error) {
      console.error('=== PAYOUT PROCESSING EXCEPTION ===');
      console.error('Payout processing exception:', error);
      console.error('Exception type:', typeof error);
      console.error('Exception message:', error instanceof Error ? error.message : String(error));
    }

    // The trigger will handle delivery_history creation, but let's also try to update it with more details
    try {
      const { error: historyUpdateError } = await supabaseClient
        .from('delivery_history')
        .update({
          distance_traveled: distance_km,
          delivery_payout: payout_amount,
          agent_location: agent_location,
          delivery_notes: `Completed via manual delivery by ${agent.name}. Distance: ${distance_km.toFixed(2)}km${payoutResult ? ' - Payout: ₹' + payout_amount : ''}`
        })
        .eq('order_id', order_id);

      if (historyUpdateError) {
        console.warn('Could not update delivery history details:', historyUpdateError);
      }
    } catch (historyError) {
      console.warn('Delivery history update failed:', historyError);
    }

    // Check if earnings already exist to prevent duplicate constraint violations
    const { data: existingEarning } = await supabaseClient
      .from('earnings')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('order_id', order_id)
      .single();

    // Only create earnings if none exist and payout function didn't succeed
    if (!existingEarning && (!payoutResult || !payoutResult.success)) {
      try {
        const { error: earningsError } = await supabaseClient
          .from('earnings')
          .insert({
            agent_id: agent.id,
            order_id: order_id,
            amount: payout_amount,
            distance_km: distance_km,
            payment_method: payment_method,
            status: 'completed',
            description: `Delivery payout for order ${order_id.slice(0, 8)}`
          });

        if (earningsError) {
          console.warn('Failed to create earnings record:', earningsError);
        }
      } catch (earningsCreateError) {
        console.warn('Earnings creation failed:', earningsCreateError);
      }
    }

    // Update agent statistics
    try {
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
            total_earnings: (currentAgent.total_earnings || 0) + payout_amount,
            last_delivery_at: new Date().toISOString()
          })
          .eq('id', agent.id);
      }
    } catch (statsError) {
      console.warn('Agent stats update failed:', statsError);
    }

    // Create order tracking record
    try {
      await supabaseClient
        .from('order_tracking')
        .insert({
          order_id: order_id,
          status: 'delivered',
          timestamp: new Date().toISOString(),
          location: agent_location || null,
          notes: `Order delivered by ${agent.name}. Distance: ${distance_km.toFixed(2)}km, Payout: ₹${payout_amount}`
        });
    } catch (trackingError) {
      console.warn('Order tracking creation failed:', trackingError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order completed successfully!',
        order: {
          id: order_id,
          customer_name: order.customer_name,
          total: order.total,
          payment_method,
          distance_km,
          payout_amount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete Delivery Error - Full Details:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('Request method:', req.method);
    console.error('Request URL:', req.url);
    console.error('Request headers:', Object.fromEntries(req.headers.entries()));
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to complete delivery. Please try again.',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
