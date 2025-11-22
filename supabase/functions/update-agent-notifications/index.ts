import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { notify_new_orders, notify_earnings_updates, notify_promotions } = body;

    console.log('Updating notifications for agent:', user.id);

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (notify_new_orders !== undefined) updateData.notify_new_orders = notify_new_orders;
    if (notify_earnings_updates !== undefined) updateData.notify_earnings_updates = notify_earnings_updates;
    if (notify_promotions !== undefined) updateData.notify_promotions = notify_promotions;

    const { data, error } = await supabase
      .from('agent_settings')
      .update(updateData)
      .eq('agent_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Notifications update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update notification settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Notifications updated successfully');

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
