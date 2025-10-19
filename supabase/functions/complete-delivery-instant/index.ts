import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Get request body
    const { order_id, payment_method } = await req.json();

    if (!order_id || !payment_method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Processing instant delivery completion:', { order_id, payment_method, user_email: user.email });

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id, email, name')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Active delivery agent not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Agent found:', { agent_id: agent.id, agent_name: agent.name });

    // Call the safe_complete_delivery database function
    const { data: result, error: completionError } = await supabase
      .rpc('safe_complete_delivery', {
        p_order_id: order_id,
        p_agent_id: agent.id,
        p_payment_method: payment_method
      });

    // Check if we got a result from the database function
    if (result) {
      // If the database function returned success, we're good
      if (result.success) {
        console.log('✅ Delivery completion result:', result);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If the database function returned success: false, check if it's a duplicate/already completed
      if (!result.success && result.message && 
          (result.message.includes('already completed') || 
           result.message.includes('concurrent request') ||
           result.message.includes('duplicate'))) {
        // Treat already completed as success
        console.log('✅ Delivery already completed:', result);
        return new Response(
          JSON.stringify({ ...result, success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Genuine error from the database function
      console.error('❌ Database function error:', result);
      return new Response(
        JSON.stringify(result),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only if we couldn't get any result at all (RPC failure, network issue, etc.)
    if (completionError) {
      console.error('❌ RPC call failed:', completionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to complete delivery - RPC error',
          details: completionError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Shouldn't reach here, but handle it just in case
    console.error('❌ No result and no error from RPC call');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unexpected error - no result returned' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unexpected error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
