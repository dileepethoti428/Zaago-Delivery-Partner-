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
    // Client with user's auth token (auth only)
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
      console.error('[update-agent-profile] Missing SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client to bypass RLS (DB writes)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey
    );

    const body = await req.json();
    const { full_name, phone, vehicle_type, vehicle_number, profile_image_url } = body;

    // Validation
    if (!full_name || full_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Full name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (vehicle_type && !['Bike', 'Scooter', 'Cycle', 'Other'].includes(vehicle_type)) {
      return new Response(JSON.stringify({ error: 'Invalid vehicle type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[update-agent-profile] Updating profile for agent:', user.id);

    // Verify agent exists
    const { data: existingAgent, error: checkError } = await serviceClient
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (checkError) {
      console.error('[update-agent-profile] Error checking agent:', checkError);
      return new Response(JSON.stringify({ error: 'Failed to verify agent' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!existingAgent) {
      console.error('[update-agent-profile] Agent not found for user:', user.id);
      return new Response(JSON.stringify({ error: 'Agent profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update delivery agent profile
    const updateData: any = {
      name: full_name,
      updated_at: new Date().toISOString(),
    };

    if (phone) updateData.phone = phone;
    if (vehicle_type) updateData.vehicle_type = vehicle_type;
    if (vehicle_number !== undefined) updateData.vehicle_number = vehicle_number;
    if (profile_image_url !== undefined) updateData.profile_image = profile_image_url;

    const { data, error } = await serviceClient
      .from('delivery_agents')
      .update(updateData)
      .eq('agent_id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[update-agent-profile] Profile update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      console.error('[update-agent-profile] No data returned after update');
      return new Response(JSON.stringify({ error: 'Profile update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[update-agent-profile] Profile updated successfully');

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[update-agent-profile] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
