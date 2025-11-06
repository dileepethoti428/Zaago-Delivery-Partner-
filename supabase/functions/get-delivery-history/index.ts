import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent profile
    const { data: profile, error: profileError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('email', user.email)
      .single();

    if (profileError || !profile) {
      console.error('Delivery agent not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Delivery agent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const paymentStatus = url.searchParams.get('payment_status'); // 'paid', 'pending', or null for all

    console.log(`Fetching delivery history for agent ${profile.id}, limit: ${limit}, offset: ${offset}`);

    // Build query
    let query = supabase
      .from('delivery_history')
      .select('*')
      .eq('agent_id', profile.id)
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply payment status filter if provided
    if (paymentStatus && (paymentStatus === 'paid' || paymentStatus === 'pending')) {
      query = query.eq('payment_status', paymentStatus);
    }

    const { data: history, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching delivery history:', historyError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch delivery history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully fetched ${history?.length || 0} delivery records`);

    return new Response(
      JSON.stringify({ 
        data: history || [],
        count: history?.length || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
