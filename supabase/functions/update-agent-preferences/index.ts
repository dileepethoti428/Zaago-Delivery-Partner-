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
    // User client (auth only)
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

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      console.error('[update-agent-preferences] Missing SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey
    );

    const body = await req.json();
    const { is_available, auto_accept_orders, preferred_language, theme_preference } = body;

    console.log('[update-agent-preferences] Updating preferences for user:', user.id);

    // Map auth user -> delivery_agents row
    const { data: agent, error: agentError } = await serviceClient
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error('[update-agent-preferences] Agent fetch error:', agentError);
      return new Response(JSON.stringify({ error: 'Failed to fetch agent profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure settings row exists
    let { data: settings, error: settingsError } = await serviceClient
      .from('agent_settings')
      .select('*')
      .eq('agent_id', agent.id)
      .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('[update-agent-preferences] Settings fetch error:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings) {
      console.log('[update-agent-preferences] Creating default settings');
      const { data: newSettings, error: createError } = await serviceClient
        .from('agent_settings')
        .insert({
          agent_id: agent.id,
          is_available: false,
          auto_accept_orders: false,
          notify_new_orders: true,
          notify_earnings_updates: true,
          notify_promotions: true,
          preferred_language: 'en',
          theme_preference: 'system',
          push_notifications: true,
          sound_alerts: true,
          vibration: true,
          ringtone_enabled: true,
          ringtone_type: 'iphone-ringtone',
          ringtone_volume: 0.8,
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (createError && createError.code !== '23505') {
        console.error('[update-agent-preferences] Settings creation error:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create settings' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      settings = newSettings ?? settings;
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (is_available !== undefined) updateData.is_available = is_available;
    if (auto_accept_orders !== undefined) updateData.auto_accept_orders = auto_accept_orders;
    if (preferred_language !== undefined) updateData.preferred_language = preferred_language;
    if (theme_preference !== undefined) updateData.theme_preference = theme_preference;

    const { data, error } = await serviceClient
      .from('agent_settings')
      .update(updateData)
      .eq('agent_id', agent.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[update-agent-preferences] Preferences update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update preferences' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If is_available changed, also update delivery_agents.is_online
    if (is_available !== undefined) {
      const { error: agentUpdateError } = await serviceClient
        .from('delivery_agents')
        .update({
          is_online: is_available,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', user.id);

      if (agentUpdateError) {
        console.error('[update-agent-preferences] Failed to update agent online status:', agentUpdateError);
      }
    }

    console.log('[update-agent-preferences] Preferences updated successfully');

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[update-agent-preferences] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
