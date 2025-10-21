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

interface PayoutConfig {
  base_pay_amount: number;
  base_pay_distance_km: number;
  per_km_min_rate: number;
  per_km_max_rate: number;
  peak_hour_start: string;
  peak_hour_end: string;
  peak_hour_order_threshold: number;
  peak_hour_bonus_amount: number;
}

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

    // Fetch payout configuration
    const { data: payoutConfig } = await supabase
      .from('payout_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('📊 Payout config loaded:', payoutConfig ? 'Yes' : 'No');

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

    // Format recent earnings from delivery_history (primary source)
    const basePay = payoutConfig?.base_pay_amount || 40;
    const baseDistanceKm = payoutConfig?.base_pay_distance_km || 3;
    const perKmRate = payoutConfig?.per_km_max_rate || 9;

    const recentEarnings = (deliveryHistory || []).slice(0, 10).map(delivery => {
      const distance = delivery.distance_traveled || 0;
      
      const distancePay = distance > baseDistanceKm ? 
        (distance - baseDistanceKm) * perKmRate : 0;
      
      const deliveryTime = new Date(delivery.completed_at).toTimeString().substring(0, 5);
      const peakStart = payoutConfig?.peak_hour_start || '06:00';
      const peakEnd = payoutConfig?.peak_hour_end || '12:00';
      const isPeakHour = deliveryTime >= peakStart && deliveryTime <= peakEnd;
      
      const subtotal = basePay + distancePay;
      const surgeAmount = isPeakHour ? subtotal * 0.15 : 0;
      const totalBeforeFee = subtotal + surgeAmount;
      const platformFee = 13;
      const expectedTotal = totalBeforeFee - platformFee;
      
      // Use actual delivery_payout if available
      const actualPayout = delivery.delivery_payout || expectedTotal;
      const peakBonus = Math.max(0, actualPayout - expectedTotal);
      
      return {
        id: delivery.id,
        order_id: delivery.order_id,
        customer_name: delivery.customer_name || 'Customer',
        amount: actualPayout,
        time: new Date(delivery.completed_at).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        delivery_date: delivery.delivery_date,
        distance_km: distance,
        breakdown: {
          base_pay: basePay,
          distance_pay: Math.round(distancePay * 100) / 100,
          peak_bonus: Math.round(peakBonus * 100) / 100
        }
      };
    });

    console.log(`✅ Formatted ${recentEarnings.length} recent earnings`);

    // Count today's peak hour orders from delivery_history
    const peakStart = payoutConfig?.peak_hour_start || '06:00';
    const peakEnd = payoutConfig?.peak_hour_end || '12:00';
    
    const peakOrdersToday = todayHistory.filter(delivery => {
      const deliveryTime = new Date(delivery.completed_at).toTimeString().substring(0, 5);
      return deliveryTime >= peakStart && deliveryTime <= peakEnd;
    }).length;

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
          payout_config: payoutConfig,
          peak_orders_today: peakOrdersToday,
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
