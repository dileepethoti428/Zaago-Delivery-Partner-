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
    const { aadhar_number_masked, driving_license_number_masked } = body;

    console.log('Updating KYC for agent:', user.id);

    const updateData: any = {
      updated_at: new Date().toISOString(),
      kyc_status: 'in_review', // Set to in_review when documents are updated
    };

    if (aadhar_number_masked !== undefined) {
      updateData.aadhar_number = aadhar_number_masked;
    }

    if (driving_license_number_masked !== undefined) {
      updateData.dl_number = driving_license_number_masked;
    }

    // Get agent ID
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    updateData.agent_id = agent.id;
    updateData.user_id = user.id;

    // Upsert agent documents
    const { data, error } = await supabase
      .from('agent_documents')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('KYC update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update KYC details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('KYC updated successfully, status set to in_review');

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
