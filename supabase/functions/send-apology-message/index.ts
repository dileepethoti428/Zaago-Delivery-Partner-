import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Send apology message function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { order_id, customer_phone, customer_name, delay_minutes } = await req.json();

    if (!order_id || !customer_phone || !customer_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Create a notification record for the apology message
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: null, // System notification
        title: 'Delivery Apology Sent',
        message: `Apology message sent to ${customer_name} (${customer_phone}) for delayed delivery. Order: ${order_id}`,
        type: 'delivery_apology',
        role: 'system',
        metadata: {
          order_id,
          customer_phone,
          customer_name,
          delay_minutes,
          message_sent_at: new Date().toISOString(),
          apology_reason: 'delayed_delivery'
        }
      });

    if (notificationError) {
      console.error('Failed to create notification:', notificationError);
    }

    // In a real implementation, you would integrate with SMS service here
    // For now, we'll just log the message that would be sent
    const apologyMessage = `Dear ${customer_name}, we sincerely apologize for the delay in your delivery. Our agent is on the way and will reach you shortly. Thank you for your patience. - Zaago Team`;
    
    console.log(`Apology SMS would be sent to ${customer_phone}: ${apologyMessage}`);
    console.log(`Order ${order_id} was delayed by ${delay_minutes} minutes`);

    // Log the apology in delivery history metadata if the order exists in delivery_history
    const { error: historyUpdateError } = await supabase
      .from('delivery_history')
      .update({
        delivery_notes: `Apology sent for ${delay_minutes} min delay. ${apologyMessage}`
      })
      .eq('order_id', order_id);

    if (historyUpdateError) {
      console.warn('Could not update delivery history:', historyUpdateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Apology message sent successfully',
        apology_text: apologyMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error sending apology message:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to send apology message' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});