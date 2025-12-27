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

    console.log('Updating profile for agent:', user.id);

    // First verify agent exists
    const { data: existingAgent, error: checkError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking agent:', checkError);
      return new Response(JSON.stringify({ error: 'Failed to verify agent' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!existingAgent) {
      console.error('Agent not found for user:', user.id);
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

    const { data, error } = await supabase
      .from('delivery_agents')
      .update(updateData)
      .eq('agent_id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Profile update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      console.error('No data returned after update');
      return new Response(JSON.stringify({ error: 'Profile update failed - no data returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Profile updated successfully');

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
