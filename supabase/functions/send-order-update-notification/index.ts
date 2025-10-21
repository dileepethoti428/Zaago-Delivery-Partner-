import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  orderId: string;
  status: string;
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID')!;
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')!;

    if (!oneSignalAppId || !oneSignalApiKey) {
      throw new Error('OneSignal credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: NotificationRequest = await req.json();
    const { orderId, status, userId } = body;

    console.log('Processing order update notification:', { orderId, status, userId });

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get user's OneSignal player ID from delivery_agents table
    let playerIds: string[] = [];
    
    // Check delivery_agents table first
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('onesignal_player_id')
      .eq('id', userId)
      .single();

    if (agent?.onesignal_player_id) {
      playerIds.push(agent.onesignal_player_id);
    }

    // Also check push_notifications table
    const { data: pushSubs } = await supabase
      .from('push_notifications')
      .select('player_id')
      .eq('user_id', userId);

    if (pushSubs && pushSubs.length > 0) {
      pushSubs.forEach((sub) => {
        if (sub.player_id && !playerIds.includes(sub.player_id)) {
          playerIds.push(sub.player_id);
        }
      });
    }

    // If no player IDs found, use external user ID as fallback
    if (playerIds.length === 0) {
      console.log('No player IDs found, using external_user_id');
    }

    // Format status for display
    const statusDisplay = status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Prepare OneSignal notification payload
    const oneSignalPayload: any = {
      app_id: oneSignalAppId,
      headings: { en: '📦 Order Update' },
      contents: { 
        en: `Your order #${orderId.slice(0, 8)} is now ${statusDisplay}` 
      },
      data: {
        orderId: orderId,
        status: status,
        url: `/order-details/${orderId}`,
        type: 'order_update',
      },
    };

    // Use player IDs if available, otherwise use external user ID
    if (playerIds.length > 0) {
      oneSignalPayload.include_player_ids = playerIds;
    } else {
      oneSignalPayload.include_external_user_ids = [userId];
    }

    console.log('Sending OneSignal notification:', oneSignalPayload);

    // Send notification via OneSignal API
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const oneSignalResult = await oneSignalResponse.json();
    console.log('OneSignal API response:', oneSignalResult);

    if (!oneSignalResponse.ok) {
      console.error('OneSignal API error:', oneSignalResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send notification',
          details: oneSignalResult 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: oneSignalResponse.status 
        }
      );
    }

    // Log notification in database
    await supabase.from('password_reset_logs').insert({
      email: 'system@zaago.com',
      event_type: 'email_sent',
      metadata: {
        action: 'onesignal_notification_sent',
        order_id: orderId,
        user_id: userId,
        status: status,
        onesignal_response: oneSignalResult,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        oneSignalResponse: oneSignalResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
