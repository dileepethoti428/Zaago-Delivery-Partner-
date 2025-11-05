import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Get agent live earnings function started")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.email) {
      console.error('❌ Authentication failed:', {
        hasAuthError: !!authError,
        authError: authError?.message,
        authErrorDetails: JSON.stringify(authError),
        hasUser: !!user,
        userEmail: user?.email
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          details: authError?.message || 'User not found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get agent ID
    const { data: agentData, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agentData) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const agentId = agentData.id;

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Fetch all earnings tracking data
    const { data: trackingData, error: trackingError } = await supabase
      .from('agent_earnings_tracking')
      .select('*')
      .eq('agent_id', agentId)
      .gte('accepted_at', monthStart)
      .order('accepted_at', { ascending: false });

    if (trackingError) {
      console.error('Error fetching tracking data:', trackingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch earnings data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Calculate earnings for different periods
    const calculatePeriodEarnings = (startDate: string) => {
      const periodData = trackingData?.filter(t => t.accepted_at >= startDate) || [];
      
      const pending = periodData
        .filter(t => t.payout_status === 'pending')
        .reduce((sum, t) => sum + (parseFloat(t.expected_payout) || 0), 0);
      
      const confirmed = periodData
        .filter(t => t.payout_status === 'confirmed')
        .reduce((sum, t) => sum + (parseFloat(t.actual_payout) || 0), 0);
      
      const deliveries = periodData.filter(t => t.payout_status === 'confirmed').length;
      const inProgress = periodData.filter(t => t.payout_status === 'pending').length;
      const cancelled = periodData.filter(t => t.payout_status === 'cancelled').length;
      const totalOrders = deliveries + inProgress + cancelled;
      
      console.log('📊 Period earnings breakdown:', {
        period: startDate,
        total_records: periodData.length,
        confirmed_count: deliveries,
        pending_count: inProgress,
        cancelled_count: cancelled,
        total_orders: totalOrders,
        confirmed_amount: confirmed.toFixed(2),
        pending_amount: pending.toFixed(2)
      });
      
      return {
        pending: parseFloat(pending.toFixed(2)),
        confirmed: parseFloat(confirmed.toFixed(2)),
        total: parseFloat((pending + confirmed).toFixed(2)),
        deliveries,
        in_progress: inProgress,
        cancelled,
        total_orders: totalOrders
      };
    };

    const todayEarnings = calculatePeriodEarnings(todayStart);
    const weekEarnings = calculatePeriodEarnings(weekStart);
    const monthEarnings = calculatePeriodEarnings(monthStart);

    // Get recent earnings details
    const recentEarnings = (trackingData || []).slice(0, 10).map(tracking => ({
      order_id: tracking.order_id,
      accepted_at: tracking.accepted_at,
      completed_at: tracking.completed_at,
      expected_payout: parseFloat(tracking.expected_payout || 0),
      actual_payout: tracking.actual_payout ? parseFloat(tracking.actual_payout) : null,
      status: tracking.payout_status,
      distance_km: parseFloat(tracking.distance_km || 0),
      is_peak_hour: tracking.is_peak_hour,
      payout_breakdown: tracking.payout_breakdown
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          today: todayEarnings,
          week: weekEarnings,
          month: monthEarnings,
          recent_earnings: recentEarnings,
          live_payout: todayEarnings.pending,
          deliveries_in_progress: todayEarnings.in_progress
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-agent-live-earnings:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
