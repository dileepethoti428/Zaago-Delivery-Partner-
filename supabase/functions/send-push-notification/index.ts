import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userEmail: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const { userEmail, title, message, data }: PushNotificationRequest = await req.json();

    console.log('[send-push-notification] Received request:', {
      userEmail,
      title,
      messageLength: message?.length,
      hasData: !!data
    });

    // Validate required fields
    if (!userEmail || !title || !message) {
      console.error('[send-push-notification] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: userEmail, title, message',
          recipients: 0,
          notification_id: null
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OneSignal credentials with fallbacks
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID') || Deno.env.get('ONESIGNAL_AGENT_APP_ID');
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_API_KEY') || Deno.env.get('ONESIGNAL_REST_API_KEY') || Deno.env.get('ONESIGNAL_AGENT_API_KEY');

    console.log('[send-push-notification] OneSignal config:', {
      hasAppId: !!oneSignalAppId,
      hasApiKey: !!oneSignalApiKey,
      appIdSource: Deno.env.get('ONESIGNAL_APP_ID') ? 'ONESIGNAL_APP_ID' : 'ONESIGNAL_AGENT_APP_ID',
      apiKeySource: Deno.env.get('ONESIGNAL_API_KEY') ? 'ONESIGNAL_API_KEY' : 
                    Deno.env.get('ONESIGNAL_REST_API_KEY') ? 'ONESIGNAL_REST_API_KEY' : 'ONESIGNAL_AGENT_API_KEY'
    });

    if (!oneSignalAppId || !oneSignalApiKey) {
      console.error('[send-push-notification] Missing OneSignal credentials');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OneSignal credentials not configured',
          recipients: 0,
          notification_id: null
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build OneSignal payload using User Model v5+ with include_aliases
    const oneSignalPayload = {
      app_id: oneSignalAppId,
      include_aliases: {
        external_id: [userEmail]
      },
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      ...(data && { data })
    };

    console.log('[send-push-notification] OneSignal payload:', JSON.stringify(oneSignalPayload, null, 2));
    console.log('[send-push-notification] Targeting user with external_id:', userEmail);

    // Send notification via OneSignal API
    const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${oneSignalApiKey}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const responseData = await oneSignalResponse.json();
    
    console.log('[send-push-notification] OneSignal API response status:', oneSignalResponse.status);
    console.log('[send-push-notification] OneSignal API response:', JSON.stringify(responseData, null, 2));

    if (!oneSignalResponse.ok) {
      console.error('[send-push-notification] OneSignal API error:', responseData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.errors?.[0] || 'Failed to send notification',
          recipients: 0,
          notification_id: null
        }),
        { status: oneSignalResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipients = responseData.recipients || 0;
    const notificationId = responseData.id || null;

    console.log('[send-push-notification] Notification sent successfully:', {
      notificationId,
      recipients,
      userEmail
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        recipients,
        notification_id: notificationId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-push-notification] Error:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        recipients: 0,
        notification_id: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
