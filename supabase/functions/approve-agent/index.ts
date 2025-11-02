import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { user_id, approved, rejection_reason } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the admin user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is an admin
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id);

    if (rolesError || !roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the target user's email
    const { data: targetUser, error: userError } = await supabaseClient.auth.admin.getUserById(user_id);
    if (userError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile approval status
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        approval_status: approved ? 'approved' : 'rejected',
        approved_by: adminUser.id,
        approved_at: approved ? new Date().toISOString() : null,
        rejection_reason: approved ? null : rejection_reason,
        documents_verified: approved ? true : false,
      })
      .eq('user_id', user_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile', details: profileError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If approved, update delivery_agents and agent_documents
    if (approved) {
      // Update delivery_agents status
      const { error: agentError } = await supabaseClient
        .from('delivery_agents')
        .update({
          verification_status: 'approved',
          documents_verified: true,
          is_active: true,
        })
        .eq('email', targetUser.user.email);

      if (agentError) {
        console.error('Agent update error:', agentError);
      }

      // Update agent_documents verification
      const { error: docError } = await supabaseClient
        .from('agent_documents')
        .update({
          aadhar_verified: true,
          dl_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: adminUser.id,
        })
        .eq('user_id', user_id);

      if (docError) {
        console.error('Document update error:', docError);
      }
    } else {
      // If rejected, update delivery_agents status
      const { error: agentError } = await supabaseClient
        .from('delivery_agents')
        .update({
          verification_status: 'rejected',
          is_active: false,
        })
        .eq('email', targetUser.user.email);

      if (agentError) {
        console.error('Agent update error:', agentError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: approved ? 'Agent approved successfully' : 'Agent rejected',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
