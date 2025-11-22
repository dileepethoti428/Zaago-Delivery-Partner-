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
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching settings for agent:', user.id);

    // Fetch delivery agent profile
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('*')
      .eq('agent_id', user.id)
      .single();

    if (agentError && agentError.code !== 'PGRST116') {
      console.error('Agent fetch error:', agentError);
      return new Response(JSON.stringify({ error: 'Failed to fetch agent profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no agent exists, create default profile
    if (!agent) {
      console.log('Creating default agent profile');
      const { data: newAgent, error: createError } = await supabase
        .from('delivery_agents')
        .insert({
          agent_id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || 'Agent',
          phone: user.phone || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Agent creation error:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create agent profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch agent settings
    let { data: settings, error: settingsError } = await supabase
      .from('agent_settings')
      .select('*')
      .eq('agent_id', user.id)
      .single();

    if (settingsError && settingsError.code === 'PGRST116') {
      // Create default settings if not exist
      console.log('Creating default agent settings');
      const { data: newSettings, error: createSettingsError } = await supabase
        .from('agent_settings')
        .insert({
          agent_id: user.id,
          is_available: true,
          auto_accept_orders: false,
          notify_new_orders: true,
          notify_earnings_updates: true,
          notify_promotions: true,
          preferred_language: 'en',
          dark_mode: false,
        })
        .select()
        .single();

      if (createSettingsError) {
        console.error('Settings creation error:', createSettingsError);
      } else {
        settings = newSettings;
      }
    }

    // Fetch bank details
    const { data: bankDetails } = await supabase
      .from('agent_bank_details')
      .select('*')
      .eq('agent_id', user.id)
      .eq('is_primary', true)
      .maybeSingle();

    // Fetch documents/KYC
    const { data: documents } = await supabase
      .from('agent_documents')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const response = {
      profile: agent || null,
      settings: settings || null,
      bankDetails: bankDetails || null,
      documents: documents || null,
    };

    console.log('Settings fetched successfully');

    return new Response(JSON.stringify(response), {
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
