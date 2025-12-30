import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StorePlayerIdRequest {
  email: string;
  playerId: string;
  platform?: string;
  app_type?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { email, playerId, platform, app_type }: StorePlayerIdRequest = await req.json();

    console.log('[store-player-id] Received request:', { email, playerId, platform, app_type });

    if (!email || !playerId) {
      console.error('[store-player-id] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'email and playerId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the delivery agent by email
    const { data: agent, error: findError } = await supabase
      .from('delivery_agents')
      .select('id, email, onesignal_player_id')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('[store-player-id] Error finding agent:', findError);
      return new Response(
        JSON.stringify({ error: 'Failed to find agent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!agent) {
      console.warn('[store-player-id] Agent not found for email:', email);
      // Agent might not be created yet, that's okay
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Agent not found, player_id will be stored on next attempt' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the agent's onesignal_player_id
    const { error: updateError } = await supabase
      .from('delivery_agents')
      .update({
        onesignal_player_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('[store-player-id] Error updating player_id:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update player_id' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[store-player-id] Successfully stored player_id for agent:', {
      agentId: agent.id,
      email: agent.email,
      playerId,
      platform,
      previousPlayerId: agent.onesignal_player_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Player ID stored successfully',
        agentId: agent.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[store-player-id] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
