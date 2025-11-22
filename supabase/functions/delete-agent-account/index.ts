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

    console.log('Soft deleting account for agent:', user.id);

    // Soft delete: Set is_active to false
    const { error: agentError } = await supabase
      .from('delivery_agents')
      .update({ 
        is_active: false,
        is_online: false,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', user.id);

    if (agentError) {
      console.error('Agent deactivation error:', agentError);
      return new Response(JSON.stringify({ error: 'Failed to deactivate account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also set agent settings is_available to false
    const { error: settingsError } = await supabase
      .from('agent_settings')
      .update({ 
        is_available: false,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', user.id);

    if (settingsError) {
      console.error('Settings update error:', settingsError);
    }

    console.log('Account soft deleted successfully');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Account deactivated successfully',
    }), {
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
