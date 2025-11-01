import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Wallet,
  Package
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
  const { toast } = useToast();

  // Use React Query for live earnings tracking from order acceptance
  const { data: earningsResponse, isLoading, refetch } = useQuery({
    queryKey: ['agent-live-earnings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('get-agent-live-earnings', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      console.log('✅ Live earnings data loaded:', {
        today_pending: data?.data?.today?.pending,
        today_confirmed: data?.data?.today?.confirmed,
        live_payout: data?.data?.live_payout
      });

      return data?.data;
    },
    staleTime: 10000, // Cache for 10 seconds (more real-time)
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    retry: 3,
    refetchInterval: 30000, // Auto-refresh every 30 seconds for live updates
  });

  // Listen for order completion and cancellation events to refresh earnings
  useEffect(() => {
    const handleOrderCompleted = (event: any) => {
      console.log('Order completed, refreshing earnings...', event.detail);
      
      // Show brief success animation
      toast({
        title: "💰 Earnings Updated!",
        description: "Your completed delivery has been added to earnings",
      });
      
      refetch();
    };

    const handleOrderCancelled = () => {
      console.log('Order cancelled, refreshing earnings...');
      refetch();
    };

    window.addEventListener('orderCompleted', handleOrderCompleted as any);
    window.addEventListener('orderCancelled', handleOrderCancelled);

    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted as any);
      window.removeEventListener('orderCancelled', handleOrderCancelled);
    };
  }, [refetch, toast]);

  // Handle errors with toast
  useEffect(() => {
    if (!isLoading && !earningsResponse) {
      toast({
        title: "Error",
        description: "Failed to load earnings data. Please try again.",
        variant: "destructive"
      });
    }
  }, [isLoading, earningsResponse, toast]);

  const earningsData = {
    today: earningsResponse?.today || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 },
    week: earningsResponse?.week || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 },
    month: earningsResponse?.month || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 }
  };
  
  const recentEarnings = (earningsResponse?.recent_earnings || []).map((earning: any) => ({
    id: earning.order_id,
    order_id: earning.order_id,
    customer_name: earning.status === 'confirmed' ? 'Completed' : 'In Progress',
    amount: earning.status === 'confirmed' ? earning.actual_payout : earning.expected_payout,
    time: new Date(earning.accepted_at).toLocaleTimeString(),
    delivery_date: new Date(earning.accepted_at).toLocaleDateString(),
    distance_km: earning.distance_km || 0,
    breakdown: earning.payout_breakdown,
    status: earning.status
  }));

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

      {/* Quick Stats - Live Pending Payout */}
      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 animate-slide-up">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Wallet className="w-6 h-6 text-green-600 animate-pulse" />
              <span className="text-3xl font-bold text-green-600">
                ₹{currentData.pending.toFixed(2)}
              </span>
            </div>
            <p className="text-green-600/80 mb-1 text-sm font-medium">
              Live Payout (Pending)
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {currentData.in_progress} order{currentData.in_progress !== 1 ? 's' : ''} in progress
            </p>
            
            <div className="bg-background/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confirmed:</span>
                <span className="font-semibold text-foreground">₹{currentData.confirmed.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">₹{currentData.total.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-background/30 rounded-lg p-2">
                <p className="text-xl font-bold text-foreground">{currentData.deliveries}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center bg-background/30 rounded-lg p-2">
                <p className="text-xl font-bold text-green-600">{currentData.in_progress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center bg-background/30 rounded-lg p-2">
                <p className="text-xl font-bold text-primary">{currentData.total_orders || 0}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Orders Summary Card */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders ({selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)})</p>
                <p className="text-2xl font-bold text-foreground">{currentData.total_orders || 0}</p>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="flex flex-col space-y-1">
                <div>
                  <span className="text-green-600 font-semibold">{currentData.deliveries}</span>
                  <span className="text-muted-foreground"> completed</span>
                </div>
                <div>
                  <span className="text-yellow-600 font-semibold">{currentData.in_progress}</span>
                  <span className="text-muted-foreground"> pending</span>
                </div>
                {(currentData.cancelled || 0) > 0 && (
                  <div>
                    <span className="text-red-600 font-semibold">{currentData.cancelled}</span>
                    <span className="text-muted-foreground"> cancelled</span>
                  </div>
                )}
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
                <p className="text-xs text-muted-foreground">Per Delivery</p>
                <p className="text-lg font-bold text-foreground">
                  ₹{((currentData.deliveries ? currentData.confirmed / currentData.deliveries : 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-green-500/10 rounded-lg">
                <Wallet className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Live Pending</p>
                <p className="text-lg font-bold text-green-600">
                  ₹{currentData.pending.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Earnings */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <div className="space-y-3 pr-4">
              {recentEarnings.length > 0 ? recentEarnings.map((earning: any) => (
                <div key={earning.id} className="p-4 bg-secondary/50 rounded-lg overflow-hidden border-l-4 border-l-transparent"
                     style={{ borderLeftColor: earning.status === 'pending' ? 'rgb(34 197 94)' : 'transparent' }}>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        earning.status === 'pending' ? 'bg-green-500/20' : 'bg-primary/20'
                      }`}>
                        <Truck className={`w-5 h-5 ${earning.status === 'pending' ? 'text-green-600' : 'text-primary'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{earning.customer_name}</p>
                          {earning.status === 'pending' && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border-green-200">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{earning.time}</span>
                          <span>•</span>
                          <span className="truncate">#{earning.order_id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-lg ${earning.status === 'pending' ? 'text-green-600' : 'text-foreground'}`}>
                        ₹{earning.amount.toFixed(2)}
                      </p>
                      {earning.distance_km > 0 && (
                        <Badge variant="secondary" className="text-xs px-2 py-1">
                          {earning.distance_km.toFixed(1)} km
                        </Badge>
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