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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[ensure-agent-exists] Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ensure-agent-exists] Checking agent for user:', user.id, user.email);

    // Use SERVICE ROLE client to bypass RLS for insert/update operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if agent already exists
    const { data: existingAgent, error: fetchError } = await serviceClient
      .from('delivery_agents')
      .select('id, agent_id, name, email, is_online, latitude, longitude')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[ensure-agent-exists] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to check agent status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If agent exists, return it
    if (existingAgent) {
      console.log('[ensure-agent-exists] Agent already exists:', existingAgent.id);
      return new Response(JSON.stringify({ 
        success: true, 
        agent: existingAgent,
        created: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Agent doesn't exist - create with default values
    console.log('[ensure-agent-exists] Creating new agent for user:', user.id);

    // Get user metadata for name/phone if available
    const userName = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split('@')[0] || 
                     'Agent';
    const userPhone = user.phone || user.user_metadata?.phone || null;

    const { data: newAgent, error: insertError } = await serviceClient
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
      .select('id, agent_id, name, email, is_online, latitude, longitude')
      .single();

    if (insertError) {
      // Handle race condition - if agent was just created by another request
      if (insertError.code === '23505') {
        console.log('[ensure-agent-exists] Agent created by concurrent request, fetching...');
        const { data: concurrentAgent } = await serviceClient
          .from('delivery_agents')
          .select('id, agent_id, name, email, is_online, latitude, longitude')
          .eq('agent_id', user.id)
          .single();
        
        return new Response(JSON.stringify({ 
          success: true, 
          agent: concurrentAgent,
          created: false 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.error('[ensure-agent-exists] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create agent', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ensure-agent-exists] Agent created successfully:', newAgent.id);

    // Also create default agent_settings
    const { error: settingsError } = await serviceClient
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
        ringtone_type: 'default',
        ringtone_volume: 80,
      })
      .select()
      .maybeSingle();

    if (settingsError && settingsError.code !== '23505') {
      console.warn('[ensure-agent-exists] Settings creation warning:', settingsError);
      // Don't fail the request, settings can be created later
    }

    return new Response(JSON.stringify({ 
      success: true, 
      agent: newAgent,
      created: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ensure-agent-exists] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
