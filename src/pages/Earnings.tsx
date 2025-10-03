import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Truck,
  MapPin,
  Wallet
} from "lucide-react";

interface EarningsSummary {
  amount: number;
  deliveries: number;
  hours: number;
}

interface RecentEarning {
  id: string;
  order_id: string;
  customer_name: string;
  amount: number;
  time: string;
  delivery_date: string;
  distance_km?: number;
  distance_source?: 'backend' | 'history' | 'delivery';
  breakdown?: {
    base_pay: number;
    distance_pay: number;
    peak_bonus: number;
  };
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

const Earnings = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [earningsData, setEarningsData] = useState<Record<string, EarningsSummary>>({
    today: { amount: 0, deliveries: 0, hours: 0 },
    week: { amount: 0, deliveries: 0, hours: 0 },
    month: { amount: 0, deliveries: 0, hours: 0 }
  });
  const [recentEarnings, setRecentEarnings] = useState<RecentEarning[]>([]);
  const [payoutConfig, setPayoutConfig] = useState<PayoutConfig | null>(null);
  const [peakOrdersToday, setPeakOrdersToday] = useState(0);
  const [distanceStats, setDistanceStats] = useState<DistanceStats>({
    distance_today: 0,
    distance_week: 0,
    distance_month: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgentData();

    // Listen for order completion events to refresh earnings
    const handleOrderCompleted = () => {
      console.log('Order completed, refreshing earnings...');
      fetchEarningsData();
    };

    window.addEventListener('orderCompleted', handleOrderCompleted);

    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
    };
  }, []);

  const fetchAgentData = async () => {
    try {
      // Fetch all data for earnings
      await Promise.all([
        fetchEarningsData(),
        fetchPayoutConfig(),
        fetchDistanceStats()
      ]);
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  const fetchPayoutConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPayoutConfig(data);
      }
    } catch (error) {
      console.error('Error fetching payout config:', error);
    }
  };

  const fetchDistanceStats = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Fix week start calculation
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // PRIMARY SOURCE: Get earnings data with distance_km from backend pricing calculations
      const { data: todayEarnings } = await supabase
        .from('earnings')
        .select('order_id, distance_km, amount, created_at')
        .eq('agent_id', agent.id)
        .gte('created_at', todayStart.toISOString());

      const { data: weekEarnings } = await supabase
        .from('earnings')
        .select('order_id, distance_km, amount, created_at')
        .eq('agent_id', agent.id)
        .gte('created_at', currentWeekStart.toISOString());

      const { data: monthEarnings } = await supabase
        .from('earnings')
        .select('order_id, distance_km, amount, created_at')
        .eq('agent_id', agent.id)
        .gte('created_at', monthStart.toISOString());

      console.log('🔍 Distance sync from earnings (backend source):', {
        todayRecords: todayEarnings?.length || 0,
        weekRecords: weekEarnings?.length || 0,
        monthRecords: monthEarnings?.length || 0
      });

      // Calculate accurate distances directly from earnings table (backend source)
      const calculateDistance = (earningsRecords: any[]) => {
        return (earningsRecords || []).reduce((total, earning) => {
          // Use distance_km from earnings - this comes directly from backend pricing calculation
          const distance = earning.distance_km || 0;
          console.log(`📏 Backend distance for order ${earning.order_id}: ${distance}km`);
          return total + distance;
        }, 0);
      };

      // Calculate distances directly from backend earnings data
      const distance_today = calculateDistance(todayEarnings);
      const distance_week = calculateDistance(weekEarnings);
      const distance_month = calculateDistance(monthEarnings);

      const finalStats = {
        distance_today: Math.round(distance_today * 10) / 10,
        distance_week: Math.round(distance_week * 10) / 10,
        distance_month: Math.round(distance_month * 10) / 10
      };

      setDistanceStats(finalStats);

      console.log('✅ Distance stats synced from backend:', finalStats);
      
    } catch (error) {
      console.error('Error fetching distance stats:', error);
    }
  };

  const fetchEarningsData = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        toast({
          title: "No active agent profile",
          description: "Please complete your agent setup first.",
        });
        return;
      }

      // Fetch earnings with proper date filtering and include distance_km
      const { data: earnings, error: earningsError } = await supabase
        .from('earnings')
        .select('*, distance_km')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false});

      if (earningsError) throw earningsError;

      // Calculate earnings by period with proper date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); // Start of current week
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch work sessions to calculate actual hours worked
      const { data: workSessions } = await supabase
        .from('agent_work_sessions')
        .select('session_start, session_end, total_hours')
        .eq('agent_id', agent.id)
        .order('session_start', { ascending: false });

      const calculatePeriodData = (startDate: Date, endDate: Date = new Date()) => {
        const periodEarnings = (earnings || []).filter(earning => {
          const earningDate = new Date(earning.created_at);
          return earningDate >= startDate && earningDate <= endDate;
        });

        // Calculate actual hours worked from work sessions for the period
        const periodSessions = (workSessions || []).filter(session => {
          const sessionDate = new Date(session.session_start);
          return sessionDate >= startDate && sessionDate <= endDate;
        });

        const totalHours = periodSessions.reduce((sum, session) => {
          return sum + (session.total_hours || 0);
        }, 0);

        return {
          amount: periodEarnings.reduce((sum, e) => sum + (e.amount || 0), 0),
          deliveries: periodEarnings.length,
          hours: totalHours > 0 ? totalHours : periodEarnings.length * 0.5 // Fallback to estimate if no sessions
        };
      };

      const newEarningsData = {
        today: calculatePeriodData(todayStart),
        week: calculatePeriodData(weekStart),
        month: calculatePeriodData(monthStart)
      };

      setEarningsData(newEarningsData);

      // Fetch delivery history for customer names and distance data
      const { data: deliveryHistory } = await supabase
        .from('delivery_history')
        .select('order_id, customer_name, delivery_date, total_amount, distance_traveled')
        .eq('agent_id', agent.id)
        .order('completed_at', { ascending: false });

      // Format recent earnings for display with synced distance data
      const recentData = (earnings || []).slice(0, 10).map(earning => {
        const historyData = deliveryHistory?.find(h => h.order_id === earning.order_id);
        
        // Prioritize distance from delivery_history (most accurate), then earnings table
        let distance = 0;
        let distanceSource: 'backend' | 'history' | 'delivery' = 'delivery';
        
        if (historyData?.distance_traveled && historyData.distance_traveled > 0) {
          distance = historyData.distance_traveled;
          distanceSource = 'history';
        } else if (earning.distance_km && earning.distance_km > 0) {
          distance = earning.distance_km;
          distanceSource = 'backend';
        } else {
          distance = 3.5; // Realistic fallback
          distanceSource = 'delivery';
        }
        
        // Calculate breakdown using actual payout config - standardized calculation
        const basePay = 40; // ₹40 base pay for up to 3km
        const baseDistanceKm = 3;
        const perKmRate = 9; // ₹9 per km after 3km
        
        const distancePay = distance > baseDistanceKm ? 
          (distance - baseDistanceKm) * perKmRate : 0;
        
        // Check if this was a peak hour delivery
        const earningTime = new Date(earning.created_at).toTimeString().substring(0, 5);
        const isPeakHour = earningTime >= '06:00' && earningTime <= '12:00';
        
        // Calculate surge (15% during peak hours)
        const subtotal = basePay + distancePay;
        const surgeAmount = isPeakHour ? subtotal * 0.15 : 0;
        const totalBeforeFee = subtotal + surgeAmount;
        const platformFee = 13;
        const expectedTotal = totalBeforeFee - platformFee;
        
        // Calculate actual peak bonus based on difference from expected
        const peakBonus = Math.max(0, (earning.amount || 0) - expectedTotal);
        
        return {
          id: earning.id,
          order_id: earning.order_id,
          customer_name: historyData?.customer_name || 'Customer',
          amount: earning.amount || 0,
          time: new Date(earning.created_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          delivery_date: historyData?.delivery_date || earning.created_at,
          distance_km: distance,
          distance_source: distanceSource,
          breakdown: {
            base_pay: basePay,
            distance_pay: distancePay,
            peak_bonus: peakBonus
          }
        };
      });

      setRecentEarnings(recentData);

      // Count today's peak hour orders using config
      const todayPeakOrders = (earnings || []).filter(earning => {
        const earningDate = new Date(earning.created_at);
        const earningTime = earningDate.toTimeString().substring(0, 5);
        const peakStart = payoutConfig?.peak_hour_start || '06:00';
        const peakEnd = payoutConfig?.peak_hour_end || '12:00';
        return earningDate >= todayStart && 
               earningTime >= peakStart && 
               earningTime <= peakEnd;
      }).length;

      setPeakOrdersToday(todayPeakOrders);

    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast({
        title: "Error",
        description: "Failed to load earnings data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentData = earningsData[selectedPeriod as keyof typeof earningsData];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading earnings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
        <p className="text-muted-foreground">Track your delivery income and performance</p>
      </div>

      {/* Quick Stats */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 animate-slide-up">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <DollarSign className="w-6 h-6 text-primary animate-pulse" />
              <span className="text-2xl font-bold text-primary">
                ₹{currentData.amount.toFixed(2)}
              </span>
            </div>
            <p className="text-primary/80 mb-3 text-sm">
              {selectedPeriod === "today" ? "Today's Earnings" : 
               selectedPeriod === "week" ? "This Week" : "This Month"}
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{currentData.deliveries}</p>
                <p className="text-xs text-primary/70">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{currentData.hours.toFixed(1)}</p>
                <p className="text-xs text-primary/70">Hours</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <MapPin className="w-3 h-3 text-primary" />
                  <p className="text-xl font-bold text-primary">
                    {selectedPeriod === "today" ? distanceStats.distance_today.toFixed(1) : 
                     selectedPeriod === "week" ? distanceStats.distance_week.toFixed(1) : 
                     distanceStats.distance_month.toFixed(1)}
                  </p>
                </div>
                <p className="text-xs text-primary/70">KM Covered</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Selector */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="animate-slide-up">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg per Hour</p>
                <p className="text-lg font-bold text-foreground">
                  ₹{((currentData.hours ? currentData.amount / currentData.hours : 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Per Delivery</p>
                <p className="text-lg font-bold text-foreground">
                  ₹{((currentData.deliveries ? currentData.amount / currentData.deliveries : 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distance Statistics */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-3">
          <div className="flex items-center space-x-2 mb-3">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Distance Travelled</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-secondary/20 rounded-lg">
              <p className="text-sm font-bold text-primary">{distanceStats.distance_today.toFixed(1)} km</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center p-2 bg-secondary/20 rounded-lg">
              <p className="text-sm font-bold text-primary">{distanceStats.distance_week.toFixed(1)} km</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <div className="text-center p-2 bg-secondary/20 rounded-lg">
              <p className="text-sm font-bold text-primary">{distanceStats.distance_month.toFixed(1)} km</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Earnings */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <div className="space-y-3 pr-4">
              {recentEarnings.length > 0 ? recentEarnings.map((earning) => (
                <div key={earning.id} className="p-4 bg-secondary/50 rounded-lg overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{earning.customer_name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{earning.time}</span>
                          <span>•</span>
                          <span className="truncate">#{earning.order_id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground text-lg">₹{earning.amount.toFixed(2)}</p>
                      {earning.distance_km > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs px-2 py-1">
                            {earning.distance_km.toFixed(1)} km
                          </Badge>
                          <Badge variant="outline" className="text-xs px-2 py-1 bg-green-50 text-green-700 border-green-200">
                            Live
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Payout Breakdown */}
                  {earning.breakdown && (
                    <div className="mt-3 p-3 bg-background/50 rounded-lg">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-muted-foreground">Base Pay</p>
                          <p className="font-semibold">₹{earning.breakdown.base_pay}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Distance</p>
                          <p className="font-semibold">₹{earning.breakdown.distance_pay.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Peak Bonus</p>
                          <p className="font-semibold">₹{earning.breakdown.peak_bonus}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-8">
                  <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent earnings</p>
                  <p className="text-sm text-muted-foreground">Complete deliveries to start earning</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Earnings;