import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// REGULAR_ORDER_PRICING removed - no longer recalculating payouts in JS
// All payout logic is now in the database (complete_delivery_zepto)

console.log("Get agent live earnings function started")

serve(async (req) => {
  // Log ALL incoming requests with full details
  const requestLog = {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.headers.get('Authorization') ? 'Bearer ***' : 'Missing',
      contentType: req.headers.get('Content-Type'),
      apikey: req.headers.get('apikey') ? '***' : 'Missing'
    }
  };
  
  console.log('🔔 INCOMING REQUEST:', JSON.stringify(requestLog, null, 2));

  // Try to read body for POST requests
  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      console.log('📦 REQUEST BODY:', bodyText || 'Empty body');
      // Create a new request with the same body since we consumed it
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: bodyText || null
      });
    } catch (e) {
      console.log('⚠️ Could not read request body:', e);
    }
  }

  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    console.log('⏱️ Starting request processing...');
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

    console.log('✅ User authenticated:', user.email);

    // Get agent ID
    console.log('⏱️ Fetching agent data for:', user.email);
    const { data: agentData, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError || !agentData) {
      console.error('❌ Agent not found:', { email: user.email, error: agentError });
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const agentId = agentData.id;
    console.log('✅ Agent found:', agentId);

    // Calculate date ranges using IST
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + IST_OFFSET);
    
    // Get IST date boundaries
    const todayISTStart = new Date(Date.UTC(
      nowIST.getUTCFullYear(),
      nowIST.getUTCMonth(),
      nowIST.getUTCDate(),
      0, 0, 0, 0
    ));
    todayISTStart.setTime(todayISTStart.getTime() - IST_OFFSET); // Convert back to UTC
    
    const weekISTStart = new Date(todayISTStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const monthISTStart = new Date(Date.UTC(
      nowIST.getUTCFullYear(),
      nowIST.getUTCMonth(),
      1, 0, 0, 0, 0
    ));
    monthISTStart.setTime(monthISTStart.getTime() - IST_OFFSET); // Convert back to UTC

    const todayStart = todayISTStart.toISOString();
    const weekStart = weekISTStart.toISOString();
    const monthStart = monthISTStart.toISOString();

    console.log('📅 IST Date ranges:', { todayStart, weekStart, monthStart });

    // Fetch earnings tracking data - use order_type column for filtering
    console.log('⏱️ Fetching earnings tracking data...');
    const { data: trackingData, error: trackingError } = await supabase
      .from('agent_earnings_tracking')
      .select('*')
      .eq('agent_id', agentId)
      .gte('accepted_at', monthStart)
      .order('accepted_at', { ascending: false });

    // Fetch all-time lightweight data (only needed columns for totals)
    const { data: allTimeData } = await supabase
      .from('agent_earnings_tracking')
      .select('expected_payout, actual_payout, payout_status')
      .eq('agent_id', agentId);

    if (trackingError) {
      console.error('❌ Error fetching tracking data:', trackingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch earnings data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Tracking data fetched:', { recordCount: trackingData?.length || 0 });

    // Separate tracking data by order_type column (more reliable than join)
    const regularOrders = trackingData?.filter(t => t.order_type === 'regular' || !t.order_type) || [];
    const subscriptionOrders = trackingData?.filter(t => t.order_type === 'subscription') || [];

    console.log('📊 Order type breakdown:', {
      regular: regularOrders.length,
      subscription: subscriptionOrders.length
    });

    // Calculate earnings for different periods and order types
    type OrderType = 'all' | 'regular' | 'subscription';
    
    const calculatePeriodEarnings = (startDate: string, orderType: OrderType = 'all') => {
      let dataSource = trackingData || [];
      
      if (orderType === 'regular') {
        dataSource = regularOrders;
      } else if (orderType === 'subscription') {
        dataSource = subscriptionOrders;
      }
      
      const periodData = dataSource.filter(t => t.accepted_at >= startDate);
      
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

    // Calculate combined earnings (existing behavior)
    const todayEarnings = calculatePeriodEarnings(todayStart, 'all');
    const weekEarnings = calculatePeriodEarnings(weekStart, 'all');
    const monthEarnings = calculatePeriodEarnings(monthStart, 'all');

    // Calculate regular order earnings
    const regularTodayEarnings = calculatePeriodEarnings(todayStart, 'regular');
    const regularWeekEarnings = calculatePeriodEarnings(weekStart, 'regular');
    const regularMonthEarnings = calculatePeriodEarnings(monthStart, 'regular');

    // Calculate subscription order earnings
    const subscriptionTodayEarnings = calculatePeriodEarnings(todayStart, 'subscription');
    const subscriptionWeekEarnings = calculatePeriodEarnings(weekStart, 'subscription');
    const subscriptionMonthEarnings = calculatePeriodEarnings(monthStart, 'subscription');

    console.log('📊 Earnings breakdown:', {
      all: { today: todayEarnings.total, week: weekEarnings.total, month: monthEarnings.total },
      regular: { today: regularTodayEarnings.total, week: regularWeekEarnings.total, month: regularMonthEarnings.total },
      subscription: { today: subscriptionTodayEarnings.total, week: subscriptionWeekEarnings.total, month: subscriptionMonthEarnings.total }
    });

    // Format recent earnings helper with Zepto/Blinkit breakdown
    const formatEarningRecord = (tracking: any) => {
      const distanceKm = parseFloat(tracking.distance_km || 0);
      const actualPayout = tracking.actual_payout ? parseFloat(tracking.actual_payout) : null;
      const orderType = tracking.order_type || 'regular';
      
      // READ-ONLY: Trust DB 100% - don't invent breakdown
      const breakdown = tracking.payout_breakdown ?? null;
      
      return {
        order_id: tracking.order_id,
        accepted_at: tracking.accepted_at,
        completed_at: tracking.completed_at,
        expected_payout: parseFloat(tracking.expected_payout || 0),
        actual_payout: actualPayout,
        status: tracking.payout_status,
        distance_km: distanceKm,
        is_peak_hour: false, // Removed peak hour from new model
        payout_breakdown: breakdown,
        subscription_id: null, // No longer querying orders table
        order_type: orderType
      };
    };

    // Get recent earnings for each type
    const recentEarnings = (trackingData || []).slice(0, 10).map(formatEarningRecord);
    const recentRegularEarnings = regularOrders.slice(0, 10).map(formatEarningRecord);
    const recentSubscriptionEarnings = subscriptionOrders.slice(0, 10).map(formatEarningRecord);

    const responseData = {
      success: true,
      data: {
        // Combined totals (existing behavior for backward compatibility)
        today: todayEarnings,
        week: weekEarnings,
        month: monthEarnings,
        recent_earnings: recentEarnings,
        live_payout: todayEarnings.pending,
        deliveries_in_progress: todayEarnings.in_progress,
        
        // NEW: Regular order earnings
        regular: {
          today: regularTodayEarnings,
          week: regularWeekEarnings,
          month: regularMonthEarnings,
          recent_earnings: recentRegularEarnings
        },
        
        // NEW: Subscription earnings
        subscription: {
          today: subscriptionTodayEarnings,
          week: subscriptionWeekEarnings,
          month: subscriptionMonthEarnings,
          recent_earnings: recentSubscriptionEarnings
        }
      }
    };

    console.log('✅ Returning earnings data successfully:', {
      todayTotal: todayEarnings.total,
      weekTotal: weekEarnings.total,
      monthTotal: monthEarnings.total,
      regularMonthTotal: regularMonthEarnings.total,
      subscriptionMonthTotal: subscriptionMonthEarnings.total,
      recentCount: recentEarnings.length
    });

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ FATAL ERROR in get-agent-live-earnings:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
