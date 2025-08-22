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
  Calendar, 
  Clock, 
  Truck,
  Star,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Download
} from "lucide-react";

interface EarningsSummary {
  amount: number;
  deliveries: number;
  hours: number;
}

interface RecentEarning {
  id: string;
  order_id: string;
  restaurant: string;
  amount: number;
  time: string;
  customer_name: string;
  delivery_date: string;
}

const Earnings = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [earningsData, setEarningsData] = useState<Record<string, EarningsSummary>>({
    today: { amount: 0, deliveries: 0, hours: 0 },
    week: { amount: 0, deliveries: 0, hours: 0 },
    month: { amount: 0, deliveries: 0, hours: 0 }
  });
  const [recentEarnings, setRecentEarnings] = useState<RecentEarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    try {
      setIsLoading(true);
      
      // Get current agent
      const agentEmail = localStorage.getItem('agent_email') || 'seshethoti@gmail.com';
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', agentEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        // No active agent found; show empty stats gracefully
        toast({
          title: "No active agent profile",
          description: "We couldn't find an active agent linked to your email. Showing empty earnings.",
        });
        return;
      }

      // Fetch earnings with delivery history
      const { data: earnings, error: earningsError } = await supabase
        .from('earnings')
        .select(`
          *,
          delivery_history (
            customer_name,
            completed_at,
            delivery_date,
            total_amount
          )
        `)
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false });

      if (earningsError) throw earningsError;

      if (earnings) {
        // Calculate earnings by period
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const calculatePeriodData = (startDate: Date, endDate: Date = now) => {
          const periodEarnings = earnings.filter(earning => {
            const earningDate = new Date(earning.created_at);
            return earningDate >= startDate && earningDate <= endDate;
          });

          return {
            amount: periodEarnings.reduce((sum, e) => sum + (e.amount || 0), 0),
            deliveries: periodEarnings.length,
            hours: periodEarnings.length * 0.5 // Estimate 30 minutes per delivery
          };
        };

        setEarningsData({
          today: calculatePeriodData(todayStart),
          week: calculatePeriodData(weekStart),
          month: calculatePeriodData(monthStart)
        });

        // Format recent earnings for display
        const recentData = earnings.slice(0, 10).map(earning => {
          const historyData = Array.isArray(earning.delivery_history) ? earning.delivery_history[0] : null;
          return {
            id: earning.id,
            order_id: earning.order_id,
            restaurant: historyData?.customer_name || 'Customer',
            amount: earning.amount || 0,
            time: new Date(earning.created_at).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            }),
            customer_name: historyData?.customer_name || 'Customer',
            delivery_date: historyData?.delivery_date || earning.created_at
          };
        });

        setRecentEarnings(recentData);
      }
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
        <p className="text-muted-foreground">Track your delivery income</p>
      </div>

      {/* Quick Stats */}
      <Card className="bg-gradient-dark border-primary/20 animate-slide-up">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <DollarSign className="w-8 h-8 text-primary animate-glow-pulse" />
              <span className="text-3xl font-bold text-foreground">
                ${currentData.amount.toFixed(2)}
              </span>
            </div>
            <p className="text-muted-foreground mb-4">
              {selectedPeriod === "today" ? "Today's Earnings" : 
               selectedPeriod === "week" ? "This Week" : "This Month"}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{currentData.deliveries}</p>
                <p className="text-sm text-muted-foreground">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{currentData.hours}</p>
                <p className="text-sm text-muted-foreground">Hours</p>
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
      <div className="grid grid-cols-2 gap-4 animate-slide-up">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg per Hour</p>
                <p className="text-xl font-bold text-foreground">
                  ${((currentData.hours ? currentData.amount / currentData.hours : 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Delivery</p>
                <p className="text-xl font-bold text-foreground">
                  ${((currentData.deliveries ? currentData.amount / currentData.deliveries : 0)).toFixed(2)}
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
          <div className="space-y-3">
            {recentEarnings.length > 0 ? recentEarnings.map((earning) => (
              <div key={earning.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
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
                  <div className="flex items-center space-x-1 text-sm">
                    <Star className="w-3 h-3 text-primary" />
                    <span className="text-primary">Commission</span>
                  </div>
                </div>
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-dark rounded-lg">
            <div className="flex items-center space-x-3">
              <CreditCard className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">Bank Account</p>
                <p className="text-sm text-muted-foreground">••••1234 - Weekly</p>
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground">Active</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button className="bg-gradient-neon hover:shadow-neon transition-smooth">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Cash Out
            </Button>
            <Button variant="outline" className="border-border">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Earnings;