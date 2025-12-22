// Edge function to update agent location - v4 (crash-proof)
// Purpose: Track LIVE delivery agent GPS location securely
// Deployment timestamp: 2025-12-22
// 
// This function:
// 1. Validates environment variables safely (no non-null assertions)
// 2. Validates JWT token and extracts user
// 3. Validates location coordinates
// 4. Checks agent exists and is active
// 5. Updates delivery_agents table with current location
// 6. Inserts history record into driver_locations

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Expected payload structure
interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

// Helper to create consistent error responses (prevents crashes from thrown errors)
function errorResponse(message: string, status: number, details?: string): Response {
  console.error(`[update-agent-location] Error ${status}: ${message}`, details || '');
  return new Response(
    JSON.stringify({ 
      success: false,
      error: message, 
      details: details || undefined 
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Helper to create success responses
function successResponse(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

Deno.serve(async (req) => {
  // ============================================
  // Step 1: Handle CORS preflight requests
  // ============================================
  if (req.method === 'OPTIONS') {
    console.log('[update-agent-location] CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[update-agent-location] ========== Request received ==========');
  console.log(`[update-agent-location] Method: ${req.method}`);

  // ============================================
  // Step 2: SAFE environment variable checks
  // These prevent crashes from missing env vars
  // ============================================
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    return errorResponse('Server misconfiguration: Missing SUPABASE_URL', 500);
  }
  if (!supabaseAnonKey) {
    return errorResponse('Server misconfiguration: Missing SUPABASE_ANON_KEY', 500);
  }
  if (!supabaseServiceKey) {
    return errorResponse('Server misconfiguration: Missing SUPABASE_SERVICE_ROLE_KEY', 500);
  }

  console.log('[update-agent-location] ✓ Environment variables validated');

  // ============================================
  // Step 3: SAFE Authorization header validation
  // Check header exists and has correct format
  // ============================================
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return errorResponse('Missing authorization header', 401);
  }

  if (!authHeader.startsWith('Bearer ')) {
    return errorResponse('Invalid authorization header format (must start with Bearer)', 401);
  }

  console.log('[update-agent-location] ✓ Authorization header present and formatted correctly');

  // ============================================
  // Step 4: Validate JWT and extract user
  // Use anon key client just for auth validation
  // Wrapped in try/catch to prevent crashes
  // ============================================
  let userId: string;
  
  try {
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError) {
      console.error('[update-agent-location] JWT validation failed:', authError.message);
      return errorResponse('Invalid or expired token', 401, authError.message);
    }

    if (!authData?.user) {
      console.error('[update-agent-location] No user in auth response');
      return errorResponse('No user found for token', 401);
    }

    userId = authData.user.id;
    console.log(`[update-agent-location] ✓ Authenticated user: ${userId}`);
  } catch (authException) {
    console.error('[update-agent-location] Auth exception:', authException);
    return errorResponse('Authentication failed', 401, String(authException));
  }

  // ============================================
  // Step 5: SAFE JSON body parsing
  // Wrapped in try/catch to handle malformed JSON
  // ============================================
  let payload: LocationPayload;
  
  try {
    payload = await req.json();
  } catch (parseError) {
    console.error('[update-agent-location] JSON parse error:', parseError);
    return errorResponse('Invalid JSON body', 400, String(parseError));
  }

  const { latitude, longitude, accuracy, heading, speed } = payload;
  console.log(`[update-agent-location] Payload received: lat=${latitude}, lng=${longitude}, accuracy=${accuracy}, heading=${heading}, speed=${speed}`);

  // ============================================
  // Step 6: Validate coordinates strictly
  // Ensure they are valid numbers within range
  // ============================================
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return errorResponse('Invalid latitude: must be a valid number', 400);
  }
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return errorResponse('Invalid longitude: must be a valid number', 400);
  }
  if (latitude < -90 || latitude > 90) {
    return errorResponse('Latitude out of range: must be between -90 and 90', 400);
  }
  if (longitude < -180 || longitude > 180) {
    return errorResponse('Longitude out of range: must be between -180 and 180', 400);
  }

  console.log('[update-agent-location] ✓ Coordinates validated');

  // ============================================
  // Step 7: Create SERVICE ROLE client
  // Used for all DB operations to bypass RLS
  // ============================================
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // ============================================
  // Step 8: Lookup agent record
  // agent_id column references auth.users.id
  // Also check is_active status
  // ============================================
  const { data: agent, error: agentError } = await supabaseAdmin
    .from('delivery_agents')
    .select('id, agent_id, is_active, name')
    .eq('agent_id', userId)
    .maybeSingle();

  if (agentError) {
    console.error('[update-agent-location] Agent lookup error:', agentError.message);
    return errorResponse('Failed to lookup agent', 500, agentError.message);
  }

  if (!agent) {
    console.error(`[update-agent-location] No agent record found for user: ${userId}`);
    return errorResponse('Agent not found for this user', 404);
  }

  console.log(`[update-agent-location] ✓ Found agent: id=${agent.id}, name=${agent.name}, is_active=${agent.is_active}`);

  // ============================================
  // Step 9: Verify agent is active
  // Inactive agents cannot update location
  // ============================================
  if (agent.is_active !== true) {
    console.warn(`[update-agent-location] Agent ${agent.id} is not active, rejecting location update`);
    return errorResponse('Agent account is not active', 403);
  }

  console.log('[update-agent-location] ✓ Agent is active');

  // ============================================
  // Step 10: Update delivery_agents table
  // Sets current location and online status
  // ============================================
  const updateTimestamp = new Date().toISOString();
  
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
    console.error('[update-agent-location] delivery_agents update error:', updateError.message);
    return errorResponse('Failed to update location in delivery_agents', 500, updateError.message);
  }

  const rowsAffected = updateData?.length || 0;
  console.log(`[update-agent-location] ✓ delivery_agents updated: ${rowsAffected} row(s) affected`);

  if (rowsAffected === 0) {
    console.error(`[update-agent-location] CRITICAL: 0 rows affected for agent ${agent.id}`);
    return errorResponse('Location update affected 0 rows', 500, `agent_id: ${agent.id}`);
  }

  // ============================================
  // Step 11: Insert into driver_locations
  // Historical tracking for analytics/debugging
  // This is secondary - don't fail if it errors
  // ============================================
  const { data: historyData, error: historyError } = await supabaseAdmin
    .from('driver_locations')
    .insert({
      agent_id: agent.id, // UUID from delivery_agents.id
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      heading: heading ?? null,
      speed: speed ?? null,
      is_active: true,
      recorded_at: updateTimestamp,
    })
    .select('id');

  if (historyError) {
    // Log warning but don't fail the request - history is secondary
    console.warn('[update-agent-location] ⚠ History insert warning (non-fatal):', historyError.message);
  } else {
    const historyId = historyData?.[0]?.id || 'unknown';
    console.log(`[update-agent-location] ✓ History record inserted: ${historyId}`);
  }

  // ============================================
  // Step 12: Return success response
  // ============================================
  console.log(`[update-agent-location] ========== SUCCESS ==========`);
  console.log(`[update-agent-location] Agent ${agent.id} (${agent.name}) location updated to (${latitude}, ${longitude})`);
  
  return successResponse({
    message: 'Location updated successfully',
    agent_id: agent.id,
    latitude,
    longitude,
    is_online: true,
    timestamp: updateTimestamp,
    rows_affected: rowsAffected,
  });
});
