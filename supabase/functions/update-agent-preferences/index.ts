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
    const { is_available, auto_accept_orders, preferred_language, dark_mode } = body;

    console.log('Updating preferences for agent:', user.id);

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (is_available !== undefined) updateData.is_available = is_available;
    if (auto_accept_orders !== undefined) updateData.auto_accept_orders = auto_accept_orders;
    if (preferred_language !== undefined) updateData.preferred_language = preferred_language;
    if (dark_mode !== undefined) updateData.dark_mode = dark_mode;

    // Update agent settings
    const { data, error } = await supabase
      .from('agent_settings')
      .update(updateData)
      .eq('agent_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Preferences update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update preferences' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If is_available changed, also update delivery_agents.is_online
    if (is_available !== undefined) {
      const { error: agentError } = await supabase
        .from('delivery_agents')
        .update({ 
          is_online: is_available,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', user.id);

      if (agentError) {
        console.error('Failed to update agent online status:', agentError);
      }
    }

    console.log('Preferences updated successfully');

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
