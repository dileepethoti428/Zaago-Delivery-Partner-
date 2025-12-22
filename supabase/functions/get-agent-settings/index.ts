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
    // Create client with user's auth token to get user info
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
      console.error('[get-agent-settings] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-agent-settings] Fetching settings for agent:', user.id);

    // Use SERVICE ROLE client to bypass RLS for insert operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch delivery agent profile
    let { data: agent, error: agentError } = await serviceClient
      .from('delivery_agents')
      .select('*')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error('[get-agent-settings] Agent fetch error:', agentError);
      return new Response(JSON.stringify({ error: 'Failed to fetch agent profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no agent exists, create default profile using SERVICE ROLE
    if (!agent) {
      console.log('[get-agent-settings] Creating default agent profile with service role');
      
      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split('@')[0] || 
                       'Agent';
      const userPhone = user.phone || user.user_metadata?.phone || null;

      const { data: newAgent, error: createError } = await serviceClient
        .from('delivery_agents')
        .insert({
          agent_id: user.id,
          email: user.email || '',
          name: userName,
          phone: userPhone,
          is_online: false,
          is_active: false,
          verification_status: 'pending',
          documents_verified: false,
          total_deliveries: 0,
          total_earnings: 0,
          average_rating: 0,
          deliveries_today: 0,
          max_capacity: 5,
        })
        .select()
        .single();

      if (createError) {
        // Handle duplicate key - fetch the existing agent
        if (createError.code === '23505') {
          console.log('[get-agent-settings] Agent exists (race condition), fetching...');
          const { data: existingAgent } = await serviceClient
            .from('delivery_agents')
            .select('*')
            .eq('agent_id', user.id)
            .single();
          agent = existingAgent;
        } else {
          console.error('[get-agent-settings] Agent creation error:', createError);
          return new Response(JSON.stringify({ error: 'Failed to create agent profile' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        agent = newAgent;
        console.log('[get-agent-settings] Agent created successfully:', newAgent?.id);
      }
    }

    // Fetch agent settings
    let { data: settings, error: settingsError } = await serviceClient
      .from('agent_settings')
      .select('*')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('[get-agent-settings] Settings fetch error:', settingsError);
    }

    // Create default settings if not exist
    if (!settings) {
      console.log('[get-agent-settings] Creating default agent settings');
      const { data: newSettings, error: createSettingsError } = await serviceClient
        .from('agent_settings')
        .insert({
          agent_id: user.id,
          is_available: false,
          auto_accept_orders: false,
          notify_new_orders: true,
          notify_earnings_updates: true,
          notify_promotions: true,
          preferred_language: 'en',
          dark_mode: false,
          push_notifications: true,
          sound_alerts: true,
          vibration: true,
          ringtone_enabled: true,
          ringtone_type: 'iphone-ringtone',
          ringtone_volume: 0.8,
        })
        .select()
        .maybeSingle();

      if (createSettingsError && createSettingsError.code !== '23505') {
        console.error('[get-agent-settings] Settings creation error:', createSettingsError);
      } else if (newSettings) {
        settings = newSettings;
      }
    }

    // Fetch bank details
    const { data: bankDetails } = await serviceClient
      .from('agent_bank_details')
      .select('*')
      .eq('agent_id', user.id)
      .eq('is_primary', true)
      .maybeSingle();

    // Fetch documents/KYC
    const { data: documents } = await serviceClient
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

    console.log('[get-agent-settings] Settings fetched successfully for agent:', agent?.id);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[get-agent-settings] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
