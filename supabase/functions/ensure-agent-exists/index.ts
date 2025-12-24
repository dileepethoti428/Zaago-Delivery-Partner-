import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

// Enhanced CORS headers with methods
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper: Soft-fail response (200 OK with success: false) - for expected conditions
function softFailResponse(reason: string, details?: string): Response {
  console.warn(`[ensure-agent-exists] Soft-fail: ${reason}`, details || '');
  return new Response(
    JSON.stringify({ success: false, reason, details }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper: Success response
function successResponse(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper: Server error response (only for true unexpected errors)
function errorResponse(message: string, details?: string): Response {
  console.error(`[ensure-agent-exists] Error: ${message}`, details || '');
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[ensure-agent-exists] Handling OPTIONS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[ensure-agent-exists] Request received:', req.method);

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return errorResponse('Server configuration error', 'Missing environment variables');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return softFailResponse('missing_auth_header', 'No Authorization header provided');
    }

    // Create client with user's auth token to get user info
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('[ensure-agent-exists] Auth error:', authError?.message);
      return softFailResponse('auth_failed', authError?.message || 'User not authenticated');
    }

    console.log('[ensure-agent-exists] Checking agent for user:', user.id, user.email);

    // Use SERVICE ROLE client to bypass RLS for insert/update operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if agent already exists
    const { data: existingAgent, error: fetchError } = await serviceClient
      .from('delivery_agents')
      .select('id, agent_id, name, email, is_online, latitude, longitude')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[ensure-agent-exists] Fetch error:', fetchError);
      return softFailResponse('fetch_failed', fetchError.message);
    }

    // If agent exists, return it
    if (existingAgent) {
      console.log('[ensure-agent-exists] Agent already exists:', existingAgent.id);
      return successResponse({ 
        agent: existingAgent,
        created: false 
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
        
        return successResponse({ 
          agent: concurrentAgent,
          created: false 
        });
      }

      console.error('[ensure-agent-exists] Insert error:', insertError);
      return softFailResponse('insert_failed', insertError.message);
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
        ringtone_type: 'iphone-ringtone',
        ringtone_volume: 0.8,
      })
      .select()
      .maybeSingle();

    if (settingsError && settingsError.code !== '23505') {
      console.warn('[ensure-agent-exists] Settings creation warning:', settingsError);
      // Don't fail the request, settings can be created later
    }

    return successResponse({ 
      agent: newAgent,
      created: true 
    });

  } catch (error) {
    console.error('[ensure-agent-exists] Unexpected error:', error);
    return errorResponse('Internal server error', error instanceof Error ? error.message : 'Unknown error');
  }
});
