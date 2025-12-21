// Edge function to update agent location - v3
// Called when agent app opens, login, splash, foreground, or focus
// Enhanced with row count verification and detailed logging
// Deployment timestamp: 2025-01-15T10:00:00Z
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[update-agent-location] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[update-agent-location] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-agent-location] Authenticated user: ${user.id}`);

    // Parse request body
    const payload: LocationPayload = await req.json();
    const { latitude, longitude, accuracy, heading, speed } = payload;

    console.log(`[update-agent-location] Received coordinates: lat=${latitude}, lng=${longitude}, accuracy=${accuracy}`);

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      console.error('[update-agent-location] Invalid coordinates type:', { latitude: typeof latitude, longitude: typeof longitude });
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates. Latitude and longitude must be numbers.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.error('[update-agent-location] Coordinates out of range:', { latitude, longitude });
      return new Response(
        JSON.stringify({ error: 'Coordinates out of valid range.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent ID from delivery_agents table using auth user id
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, agent_id')
      .eq('agent_id', user.id)
      .single();

    if (agentError) {
      console.error('[update-agent-location] Error fetching agent:', agentError);
      return new Response(
        JSON.stringify({ error: 'Agent not found', details: agentError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agent) {
      console.error('[update-agent-location] No agent found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Agent not found for this user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-agent-location] Found agent: id=${agent.id}, agent_id=${agent.agent_id}`);

    // Use SERVICE ROLE for updates to bypass RLS
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const updateTimestamp = new Date().toISOString();

    // Update delivery_agents table with current location using SERVICE ROLE
    console.log(`[update-agent-location] Updating delivery_agents where id=${agent.id}`);
    
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('delivery_agents')
      .update({
        latitude: latitude,
        longitude: longitude,
        is_online: true,
        last_location_updated_at: updateTimestamp,
      })
      .eq('id', agent.id)
      .select('id, latitude, longitude, is_online, last_location_updated_at');

    if (updateError) {
      console.error('[update-agent-location] Error updating agent location:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update location', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify rows were affected
    const rowsAffected = updateData?.length || 0;
    console.log(`[update-agent-location] Update result: ${rowsAffected} rows affected`);
    console.log(`[update-agent-location] Updated data:`, JSON.stringify(updateData));

    if (rowsAffected === 0) {
      console.error(`[update-agent-location] CRITICAL: Update affected 0 rows for agent id=${agent.id}`);
      return new Response(
        JSON.stringify({ 
          error: 'Update affected 0 rows', 
          agent_id: agent.id,
          message: 'Agent record may not exist or update failed silently'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-agent-location] Successfully updated agent ${agent.id} location to (${latitude}, ${longitude})`);

    // Insert into driver_locations for historical tracking
    const { data: historyData, error: historyError } = await supabaseAdmin
      .from('driver_locations')
      .insert({
        agent_id: agent.id,
        latitude,
        longitude,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        is_active: true,
        recorded_at: updateTimestamp,
      })
      .select('id');

    if (historyError) {
      // Log but don't fail - history is secondary
      console.warn('[update-agent-location] Error inserting location history:', historyError);
    } else {
      console.log(`[update-agent-location] Inserted location history: ${historyData?.[0]?.id}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Location updated successfully',
        rows_affected: rowsAffected,
        agent_id: agent.id,
        latitude: latitude,
        longitude: longitude,
        timestamp: updateTimestamp
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-agent-location] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
