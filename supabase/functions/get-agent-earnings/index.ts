import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EarningsSummary {
  amount: number;
  deliveries: number;
  hours: number;
}

// PayoutConfig removed - no longer recalculating payouts in JS
// All payout logic is now in the database (complete_delivery_zepto)

interface DistanceStats {
  distance_today: number;
  distance_week: number;
  distance_month: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    // Create Supabase client with user's auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      console.error('❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Authenticated user:', user.email);

    // Get agent ID
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Agent profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Agent ID:', agent.id);

    // Payout config no longer needed - all payout logic is in DB

    // Fetch delivery_history as PRIMARY source (contains all completed deliveries)
    const { data: deliveryHistory, error: historyError } = await supabase
      .from('delivery_history')
      .select('*')
      .eq('agent_id', agent.id)
      .order('completed_at', { ascending: false });

    if (historyError) {
      console.error('❌ Error fetching delivery history:', historyError);
      throw historyError;
    }

    console.log(`✅ Fetched ${deliveryHistory?.length || 0} delivery history records`);

    // Fetch earnings table as SECONDARY source (for backward compatibility)
    const { data: earnings } = await supabase
      .from('earnings')
      .select('*, distance_km')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false });

    console.log(`✅ Fetched ${earnings?.length || 0} earnings records`);

    // Fetch work sessions
    const { data: workSessions } = await supabase
      .from('agent_work_sessions')
      .select('session_start, session_end, total_hours')
      .eq('agent_id', agent.id)
      .order('session_start', { ascending: false });

    console.log(`✅ Fetched ${workSessions?.length || 0} work sessions`);

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper function to calculate period data from delivery_history
    const calculatePeriodData = (startDate: Date, endDate: Date = new Date()): EarningsSummary => {
      // Use delivery_history as primary source
      const periodDeliveries = (deliveryHistory || []).filter(delivery => {
        const deliveryDate = new Date(delivery.completed_at);
        return deliveryDate >= startDate && deliveryDate <= endDate;
      });

      const periodSessions = (workSessions || []).filter(session => {
        const sessionDate = new Date(session.session_start);
        return sessionDate >= startDate && sessionDate <= endDate;
      });

      const totalHours = periodSessions.reduce((sum, session) => {
        return sum + (session.total_hours || 0);
      }, 0);

      // Calculate total earnings from delivery_history
      const totalAmount = periodDeliveries.reduce((sum, delivery) => {
        // Use delivery_payout if available, otherwise use 0
        return sum + (delivery.delivery_payout || 0);
      }, 0);

      return {
        amount: totalAmount,
        deliveries: periodDeliveries.length,
        hours: totalHours > 0 ? totalHours : periodDeliveries.length * 0.5
      };
    };

    // Calculate earnings summary
    const earningsSummary = {
      today: calculatePeriodData(todayStart),
      week: calculatePeriodData(weekStart),
      month: calculatePeriodData(monthStart)
    };

    console.log('📊 Earnings summary:', earningsSummary);

    // Calculate distance stats from delivery_history
    const todayStartStr = todayStart.toISOString().split('T')[0];
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const todayHistory = (deliveryHistory || []).filter(d => d.delivery_date >= todayStartStr);
    const weekHistory = (deliveryHistory || []).filter(d => d.delivery_date >= weekStartStr);
    const monthHistory = (deliveryHistory || []).filter(d => d.delivery_date >= monthStartStr);

    const calculateDistance = (historyRecords: any[]) => {
      return (historyRecords || []).reduce((total, record) => {
        return total + (record.distance_traveled || 0);
      }, 0);
    };

    const distanceStats: DistanceStats = {
      distance_today: Math.round(calculateDistance(todayHistory) * 10) / 10,
      distance_week: Math.round(calculateDistance(weekHistory) * 10) / 10,
      distance_month: Math.round(calculateDistance(monthHistory) * 10) / 10
    };

    console.log('📏 Distance stats:', distanceStats);

    // Format recent earnings from delivery_history (READ-ONLY - trust DB 100%)
    const recentEarnings = (deliveryHistory || []).slice(0, 10).map(delivery => {
      return {
        id: delivery.id,
        order_id: delivery.order_id,
        customer_name: delivery.customer_name || 'Customer',
        amount: delivery.delivery_payout ?? 0,  // Trust DB
        time: new Date(delivery.completed_at).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        delivery_date: delivery.delivery_date,
        distance_km: delivery.distance_traveled ?? 0,  // Trust DB
        breakdown: delivery.payout_breakdown ?? null   // If DB didn't store it, don't invent it
      };
    });

    console.log(`✅ Formatted ${recentEarnings.length} recent earnings (READ-ONLY from DB)`);

    // Calculate performance metrics
    const todayData = earningsSummary.today;
    const performanceMetrics = {
      avg_per_hour: todayData.hours ? todayData.amount / todayData.hours : 0,
      avg_per_delivery: todayData.deliveries ? todayData.amount / todayData.deliveries : 0
    };

    console.log('✅ Successfully prepared all earnings data');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          earnings_summary: earningsSummary,
          distance_stats: distanceStats,
          recent_earnings: recentEarnings,
          performance_metrics: performanceMetrics
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in get-agent-earnings:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
