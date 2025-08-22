import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Truck,
  Star,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Download,
  MapPin,
  Target,
  Gift,
  Info
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
    fetchEarningsData();
    fetchPayoutConfig();
    fetchDistanceStats();

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

      // Call the database function to get distance stats
      const { data, error } = await supabase.rpc('get_agent_distance_stats', {
        agent_uuid: agent.id
      });

      if (error) throw error;

      if (data) {
        setDistanceStats(data as unknown as DistanceStats);
      }
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

      // Fetch earnings with proper date filtering
      const { data: earnings, error: earningsError } = await supabase
        .from('earnings')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false});

      if (earningsError) throw earningsError;

      // Calculate earnings by period with proper date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); // Start of current week
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const calculatePeriodData = (startDate: Date, endDate: Date = new Date()) => {
        const periodEarnings = (earnings || []).filter(earning => {
          const earningDate = new Date(earning.created_at);
          return earningDate >= startDate && earningDate <= endDate;
        });

        return {
          amount: periodEarnings.reduce((sum, e) => sum + (e.amount || 0), 0),
          deliveries: periodEarnings.length,
          hours: periodEarnings.length * 0.5 // Estimate 30 minutes per delivery
        };
      };

      const newEarningsData = {
        today: calculatePeriodData(todayStart),
        week: calculatePeriodData(weekStart),
        month: calculatePeriodData(monthStart)
      };

      setEarningsData(newEarningsData);

      // Fetch delivery history for customer names and recent earnings display
      const { data: deliveryHistory } = await supabase
        .from('delivery_history')
        .select('order_id, customer_name, delivery_date, total_amount, distance_traveled')
        .eq('agent_id', agent.id)
        .order('completed_at', { ascending: false });

      // Format recent earnings for display
      const recentData = (earnings || []).slice(0, 10).map(earning => {
        const historyData = deliveryHistory?.find(h => h.order_id === earning.order_id);
        
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
          breakdown: {
            base_pay: 15, // Default base pay
            distance_pay: Math.max(0, (earning.amount || 0) - 15),
            peak_bonus: 0 // Will be calculated properly with payout data
          }
        };
      });

      setRecentEarnings(recentData);

      // Count today's peak hour orders (6 AM - 12 PM)
      const todayPeakOrders = (earnings || []).filter(earning => {
        const earningDate = new Date(earning.created_at);
        const earningTime = earningDate.toTimeString().substring(0, 5);
        return earningDate >= todayStart && 
               earningTime >= '06:00' && 
               earningTime <= '12:00';
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
        <p className="text-muted-foreground">Track your delivery income with our new payout structure</p>
      </div>

      {/* Payout Structure Information */}
      {payoutConfig && (
        <Card className="bg-gradient-dark border-primary/20 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-primary" />
              <span>New Payout Structure</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Base Pay</span>
                </div>
                <p className="text-lg font-bold text-primary">₹{payoutConfig.base_pay_amount}</p>
                <p className="text-xs text-muted-foreground">
                  Within {payoutConfig.base_pay_distance_km} km
                </p>
              </div>
              
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Per KM</span>
                </div>
                <p className="text-lg font-bold text-primary">
                  ₹{payoutConfig.per_km_min_rate}-₹{payoutConfig.per_km_max_rate}
                </p>
                <p className="text-xs text-muted-foreground">
                  Beyond {payoutConfig.base_pay_distance_km} km
                </p>
              </div>
              
              <div className="bg-secondary/50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <Gift className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Peak Bonus</span>
                </div>
                <p className="text-lg font-bold text-primary">₹{payoutConfig.peak_hour_bonus_amount}</p>
                <p className="text-xs text-muted-foreground">
                  {payoutConfig.peak_hour_order_threshold} orders ({payoutConfig.peak_hour_start}-{payoutConfig.peak_hour_end})
                </p>
              </div>
            </div>
            
            {/* Peak Hour Progress */}
            <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Peak Hour Progress</span>
                </h4>
                <Badge variant={peakOrdersToday >= (payoutConfig.peak_hour_order_threshold || 14) ? "default" : "secondary"} className="text-xs">
                  {peakOrdersToday}/{payoutConfig.peak_hour_order_threshold || 14}
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (peakOrdersToday / (payoutConfig.peak_hour_order_threshold || 14)) * 100)}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {peakOrdersToday >= (payoutConfig.peak_hour_order_threshold || 14) 
                  ? `🎉 ₹${payoutConfig.peak_hour_bonus_amount} bonus earned!`
                  : `${(payoutConfig.peak_hour_order_threshold || 14) - peakOrdersToday} more for ₹${payoutConfig.peak_hour_bonus_amount}`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Card className="bg-gradient-success border-success/20 animate-slide-up">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <DollarSign className="w-6 h-6 text-success animate-glow-pulse" />
              <span className="text-2xl font-bold text-success">
                ₹{currentData.amount.toFixed(2)}
              </span>
            </div>
            <p className="text-success/80 mb-3 text-sm">
              {selectedPeriod === "today" ? "Today's Earnings" : 
               selectedPeriod === "week" ? "This Week" : "This Month"}
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-success">{currentData.deliveries}</p>
                <p className="text-xs text-success/70">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-success">{currentData.hours.toFixed(1)}</p>
                <p className="text-xs text-success/70">Hours</p>
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
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Distance Traveled</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-secondary/20 rounded-lg">
              <p className="text-lg font-bold text-primary">{distanceStats.distance_today} km</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center p-3 bg-secondary/20 rounded-lg">
              <p className="text-lg font-bold text-primary">{distanceStats.distance_week} km</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <div className="text-center p-3 bg-secondary/20 rounded-lg">
              <p className="text-lg font-bold text-primary">{distanceStats.distance_month} km</p>
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
          <div className="space-y-3">
            {recentEarnings.length > 0 ? recentEarnings.map((earning) => (
              <div key={earning.id} className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{earning.customer_name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{earning.time}</span>
                        <span>•</span>
                        <span>#{earning.order_id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-foreground">₹{earning.amount.toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Payout Breakdown */}
                {earning.breakdown && (
                  <div className="mt-3 p-3 bg-background/50 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-xs">
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
        </CardContent>
      </Card>

      {/* Payout Section */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span>Payout Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between p-3 bg-gradient-dark rounded-lg">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-sm">Bank Account</p>
                  <p className="text-xs text-muted-foreground">••••1234 - Weekly</p>
                </div>
              </div>
              <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-gradient-neon hover:shadow-neon transition-smooth text-sm">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Cash Out
              </Button>
              <Button variant="outline" className="border-border text-sm">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Earnings;