import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Info,
  Plus,
  Building,
  Shield,
  CheckCircle
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

interface BankDetails {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  account_type: string;
  is_primary: boolean;
  is_verified: boolean;
}

interface WalletData {
  balance: number;
  pending_cod_amount: number;
  total_collected: number;
}

interface WithdrawalForm {
  amount: number;
  bank_id: string;
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
  const [agentId, setAgentId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails[]>([]);
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 0,
    pending_cod_amount: 0,
    total_collected: 0
  });
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [newBankDetails, setNewBankDetails] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'savings'
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>({
    amount: 0,
    bank_id: ''
  });
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id, name')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        setAgentId(agent.id);
        setNewBankDetails(prev => ({ ...prev, account_holder_name: agent.name || '' }));
        
        // Fetch all data for this agent
        await Promise.all([
          fetchEarningsData(),
          fetchPayoutConfig(),
          fetchDistanceStats(),
          fetchBankDetails(agent.id),
          fetchWalletData(agent.id)
        ]);
      }
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  const fetchBankDetails = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_bank_details')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBankDetails(data || []);
    } catch (error) {
      console.error('Error fetching bank details:', error);
    }
  };

  const fetchWalletData = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_wallet')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWalletData(data);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
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

  const handleBankDetailsSubmit = async () => {
    if (!agentId || !validateBankForm()) return;

    setBankLoading(true);
    try {
      const { error } = await supabase
        .from('agent_bank_details')
        .insert({
          agent_id: agentId,
          ...newBankDetails,
          is_primary: bankDetails.length === 0,
          is_verified: false
        });

      if (error) throw error;

      toast({
        title: "Bank Details Added",
        description: "Your bank account has been added successfully.",
      });

      // Refresh bank details
      await fetchBankDetails(agentId);
      setShowBankDialog(false);
      setNewBankDetails({
        bank_name: '',
        account_holder_name: newBankDetails.account_holder_name,
        account_number: '',
        ifsc_code: '',
        account_type: 'savings'
      });
    } catch (error) {
      console.error('Error adding bank details:', error);
      toast({
        title: "Error",
        description: "Failed to add bank details. Please try again.",
        variant: "destructive"
      });
    } finally {
      setBankLoading(false);
    }
  };

  const validateBankForm = () => {
    const { bank_name, account_holder_name, account_number, ifsc_code } = newBankDetails;
    
    if (!bank_name.trim()) {
      toast({ title: "Bank name is required", variant: "destructive" });
      return false;
    }
    if (!account_holder_name.trim()) {
      toast({ title: "Account holder name is required", variant: "destructive" });
      return false;
    }
    if (!account_number.trim() || account_number.length < 9) {
      toast({ title: "Valid account number is required", variant: "destructive" });
      return false;
    }
    if (!ifsc_code.trim() || ifsc_code.length !== 11) {
      toast({ title: "Valid IFSC code is required (11 characters)", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleCashOut = async () => {
    if (!agentId || bankDetails.length === 0) {
      toast({
        title: "Add Bank Details",
        description: "Please add your bank details to cash out.",
        variant: "destructive"
      });
      return;
    }

    const minWithdrawal = 100;
    if (walletData.balance < minWithdrawal) {
      toast({
        title: "Minimum Withdrawal Amount",
        description: `Minimum withdrawal amount is ₹${minWithdrawal}. Your current balance is ₹${walletData.balance.toFixed(2)}.`,
        variant: "destructive"
      });
      return;
    }

    // Set default withdrawal amount and open dialog
    const primaryBank = bankDetails.find(bank => bank.is_primary) || bankDetails[0];
    setWithdrawalForm({
      amount: walletData.balance,
      bank_id: primaryBank.id
    });
    setShowWithdrawalDialog(true);
  };

  const handleWithdrawalSubmit = async () => {
    if (!agentId || !withdrawalForm.bank_id) return;

    const minWithdrawal = 100;
    if (withdrawalForm.amount < minWithdrawal) {
      toast({
        title: "Minimum Withdrawal Amount",
        description: `Minimum withdrawal amount is ₹${minWithdrawal}.`,
        variant: "destructive"
      });
      return;
    }

    if (withdrawalForm.amount > walletData.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You can withdraw maximum ₹${walletData.balance.toFixed(2)}.`,
        variant: "destructive"
      });
      return;
    }

    setWithdrawalLoading(true);
    try {
      // Create withdrawal request in backend
      const { error } = await supabase
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agentId,
          amount: -withdrawalForm.amount, // Negative for withdrawal
          transaction_type: 'withdrawal',
          description: `Withdrawal to bank account`,
          status: 'pending'
        });

      if (error) throw error;

      // Update wallet balance
      await supabase
        .from('agent_wallet')
        .update({ balance: walletData.balance - withdrawalForm.amount })
        .eq('agent_id', agentId);

      // Refresh wallet data
      await fetchWalletData(agentId);

      toast({
        title: "Withdrawal Request Submitted",
        description: `₹${withdrawalForm.amount.toFixed(2)} will be transferred to your bank account within 1-2 business days.`,
      });

      setShowWithdrawalDialog(false);
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast({
        title: "Withdrawal Failed",
        description: "There was an error processing your withdrawal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const handleClearWallet = async () => {
    if (!agentId) return;

    const minClearAmount = 500;
    if (walletData.pending_cod_amount < minClearAmount) {
      toast({
        title: "Minimum Clear Amount",
        description: `Minimum amount to clear wallet is ₹${minClearAmount}. Current pending COD: ₹${walletData.pending_cod_amount.toFixed(2)}.`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Call Razorpay settlement function
      const { data, error } = await supabase.functions.invoke('settle-cod-amount', {
        body: { 
          agent_id: agentId,
          amount: walletData.pending_cod_amount 
        }
      });

      if (error) throw error;

      // Update wallet to clear pending COD
      await supabase
        .from('agent_wallet')
        .update({ 
          pending_cod_amount: 0,
          last_settlement_date: new Date().toISOString()
        })
        .eq('agent_id', agentId);

      // Create transaction record
      await supabase
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agentId,
          amount: -walletData.pending_cod_amount,
          transaction_type: 'cod_settlement',
          description: 'COD amount settled to admin',
          status: 'completed'
        });

      // Refresh wallet data
      await fetchWalletData(agentId);

      toast({
        title: "COD Amount Settled",
        description: `₹${walletData.pending_cod_amount.toFixed(2)} COD amount has been transferred to admin via Razorpay.`,
      });
    } catch (error) {
      console.error('Error clearing wallet:', error);
      toast({
        title: "Settlement Failed",
        description: "There was an error settling COD amount. Please try again.",
        variant: "destructive"
      });
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
        <CardContent className="space-y-4">
          {/* Wallet Balance */}
          <div className="p-4 bg-gradient-success/10 border border-success/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <span className="text-2xl font-bold text-success">₹{walletData.balance.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {walletData.pending_cod_amount > 0 && (
                <div className="p-2 bg-warning/10 border border-warning/20 rounded">
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">Pending COD</span>
                    <span className="text-sm font-medium text-warning">₹{walletData.pending_cod_amount.toFixed(2)}</span>
                  </div>
                  <Button
                    onClick={handleClearWallet}
                    disabled={walletData.pending_cod_amount < 500}
                    className="w-full mt-2 h-6 text-xs bg-warning/20 hover:bg-warning/30 text-warning"
                    variant="ghost"
                  >
                    {walletData.pending_cod_amount >= 500 ? 'Clear Wallet' : 'Min ₹500'}
                  </Button>
                </div>
              )}
              <div className="p-2 bg-info/10 border border-info/20 rounded text-center">
                <span className="text-xs text-muted-foreground block">Total Collected</span>
                <span className="text-sm font-medium text-info">₹{walletData.total_collected.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Bank Accounts</h4>
            {bankDetails.length > 0 ? (
              <div className="space-y-2">
                {bankDetails.map((bank) => (
                  <div key={bank.id} className="flex items-center justify-between p-3 bg-gradient-dark rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{bank.bank_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ••••{bank.account_number.slice(-4)} - {bank.account_holder_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {bank.is_verified && (
                        <CheckCircle className="w-4 h-4 text-success" />
                      )}
                      {bank.is_primary && (
                        <Badge className="bg-primary text-primary-foreground text-xs">Primary</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-secondary/20 rounded-lg border-2 border-dashed border-secondary">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No bank accounts added</p>
                <p className="text-xs text-muted-foreground">Add your bank details to receive payments</p>
              </div>
            )}
            
            {/* Add Bank Account Dialog */}
            <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary/10">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bank Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-primary" />
                    <span>Add Bank Account</span>
                  </DialogTitle>
                  <DialogDescription>
                    Add your bank details to withdraw your earnings
                  </DialogDescription>
                </DialogHeader>
                
                {/* Prominent Balance and Withdrawal Info */}
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-success border border-success/30 rounded-lg">
                    <div className="text-center mb-3">
                      <p className="text-sm font-medium text-success/80 mb-1">Available to Withdraw</p>
                      <p className="text-3xl font-bold text-success">₹{walletData.balance.toFixed(2)}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-2 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Minimum</p>
                        <p className="font-semibold text-sm">₹100</p>
                      </div>
                      <div className="p-2 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Processing</p>
                        <p className="font-semibold text-sm">1-2 days</p>
                      </div>
                    </div>
                    
                    {walletData.balance < 100 && (
                      <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded text-center">
                        <p className="text-xs text-warning">
                          Need ₹{(100 - walletData.balance).toFixed(2)} more to withdraw
                        </p>
                      </div>
                    )}
                    
                    {walletData.pending_cod_amount > 0 && (
                      <div className="mt-3 p-2 bg-info/10 border border-info/20 rounded text-center">
                        <p className="text-xs text-info">
                          ₹{walletData.pending_cod_amount.toFixed(2)} pending COD settlement
                        </p>
                      </div>
                    )}
                  </div>
                  
                    {walletData.balance >= 100 ? (
                      <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                        <CheckCircle className="w-6 h-6 text-primary mx-auto mb-2" />
                        <p className="text-sm font-medium text-primary">Ready to withdraw!</p>
                        <p className="text-xs text-muted-foreground">Add your bank details to withdraw any amount from ₹100 to ₹{walletData.balance.toFixed(2)}</p>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/50 border border-muted rounded-lg text-center">
                        <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Complete more deliveries</p>
                        <p className="text-xs text-muted-foreground">Earn ₹{(100 - walletData.balance).toFixed(2)} more to reach minimum withdrawal</p>
                      </div>
                    )}
                  </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bank_name">Bank Name *</Label>
                    <Input
                      id="bank_name"
                      value={newBankDetails.bank_name}
                      onChange={(e) => setNewBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                      placeholder="e.g., State Bank of India"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_holder_name">Account Holder Name *</Label>
                    <Input
                      id="account_holder_name"
                      value={newBankDetails.account_holder_name}
                      onChange={(e) => setNewBankDetails(prev => ({ ...prev, account_holder_name: e.target.value }))}
                      placeholder="As per bank records"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_number">Account Number *</Label>
                    <Input
                      id="account_number"
                      value={newBankDetails.account_number}
                      onChange={(e) => setNewBankDetails(prev => ({ ...prev, account_number: e.target.value }))}
                      placeholder="Enter your account number"
                      className="mt-1"
                      type="number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ifsc_code">IFSC Code *</Label>
                    <Input
                      id="ifsc_code"
                      value={newBankDetails.ifsc_code}
                      onChange={(e) => setNewBankDetails(prev => ({ ...prev, ifsc_code: e.target.value.toUpperCase() }))}
                      placeholder="e.g., SBIN0001234"
                      className="mt-1"
                      maxLength={11}
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_type">Account Type</Label>
                    <Select 
                      value={newBankDetails.account_type} 
                      onValueChange={(value) => setNewBankDetails(prev => ({ ...prev, account_type: value }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="current">Current Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Security Note */}
                  <div className="flex items-start space-x-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Shield className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Your bank details are encrypted and stored securely. Bank verification may take 24-48 hours.
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleBankDetailsSubmit}
                      disabled={bankLoading}
                      className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
                    >
                      {bankLoading ? "Adding..." : "Add Account"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowBankDialog(false)}
                      disabled={bankLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                onClick={handleCashOut}
                disabled={bankDetails.length === 0 || walletData.balance < 100}
                className="bg-gradient-neon hover:shadow-neon transition-smooth text-sm"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                {walletData.balance < 100 ? `Min ₹100` : 'Withdraw'}
              </Button>
              <Button variant="outline" className="border-border text-sm">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>

            {/* Withdrawal Amount Dialog */}
            <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    <span>Withdraw Earnings</span>
                  </DialogTitle>
                  <DialogDescription>
                    Enter the amount you want to withdraw
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Available Balance */}
                  <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-2xl font-bold text-success">₹{walletData.balance.toFixed(2)}</p>
                  </div>

                  {/* Withdrawal Amount */}
                  <div>
                    <Label htmlFor="withdrawal_amount">Withdrawal Amount *</Label>
                    <Input
                      id="withdrawal_amount"
                      type="number"
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="Enter amount"
                      className="mt-1"
                      min="100"
                      max={walletData.balance}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Min: ₹100 • Max: ₹{walletData.balance.toFixed(2)}
                    </p>
                  </div>

                  {/* Bank Selection */}
                  {bankDetails.length > 1 && (
                    <div>
                      <Label htmlFor="bank_selection">Select Bank Account</Label>
                      <Select 
                        value={withdrawalForm.bank_id} 
                        onValueChange={(value) => setWithdrawalForm(prev => ({ ...prev, bank_id: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Choose bank account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankDetails.map((bank) => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.bank_name} - ••••{bank.account_number.slice(-4)}
                              {bank.is_primary && ' (Primary)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => setWithdrawalForm(prev => ({ ...prev, amount: Math.min(500, walletData.balance) }))}
                    >
                      ₹500
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => setWithdrawalForm(prev => ({ ...prev, amount: Math.min(1000, walletData.balance) }))}
                    >
                      ₹1000
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => setWithdrawalForm(prev => ({ ...prev, amount: walletData.balance }))}
                    >
                      All
                    </Button>
                  </div>

                  {/* Processing Info */}
                  <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                    <p className="text-xs text-muted-foreground text-center">
                      Processing time: 1-2 business days • No additional fees
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleWithdrawalSubmit}
                      disabled={withdrawalLoading || withdrawalForm.amount < 100 || withdrawalForm.amount > walletData.balance}
                      className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
                    >
                      {withdrawalLoading ? "Processing..." : `Withdraw ₹${withdrawalForm.amount}`}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowWithdrawalDialog(false)}
                      disabled={withdrawalLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Earnings;