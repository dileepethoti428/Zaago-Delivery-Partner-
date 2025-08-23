import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import WalletActions from "./WalletActions";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle, 
  XCircle,
  History,
  Plus,
  Download,
  CreditCard
} from "lucide-react";

interface WalletData {
  balance: number;
  pending_cod_amount: number;
  total_collected: number;
}

interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  status: string;
  created_at: string;
  settlement_reference?: string;
  razorpay_transaction_id?: string;
}

interface WalletDisplayProps {
  agentId?: string | null;
}

const WalletDisplay = ({ agentId }: WalletDisplayProps) => {
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 0,
    pending_cod_amount: 0,
    total_collected: 0
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(agentId || null);
  const { toast } = useToast();

  useEffect(() => {
    if (!currentAgentId) {
      fetchAgentId();
    } else {
      fetchWalletData();
    }
  }, [currentAgentId]);

  const fetchAgentId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        setCurrentAgentId(agent.id);
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
    }
  };

  const fetchWalletData = async () => {
    if (!currentAgentId) return;
    
    try {
      setIsLoading(true);
      
      // Fetch wallet data
      const { data: wallet, error: walletError } = await supabase
        .from('agent_wallet')
        .select('*')
        .eq('agent_id', currentAgentId)
        .maybeSingle();

      if (walletError) throw walletError;
      
      if (wallet) {
        setWalletData(wallet);
      }

      // Fetch recent transactions
      const { data: txns, error: txnError } = await supabase
        .from('agent_wallet_transactions')
        .select('*')
        .eq('agent_id', currentAgentId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txnError) throw txnError;
      
      if (txns) {
        setTransactions(txns);
      }

    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast({
        title: "Error",
        description: "Failed to load wallet data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'bank_transfer':
      case 'withdrawal':
        return <Download className="w-4 h-4 text-red-500" />;
      case 'delivery_payment':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'cod_settlement':
        return <ArrowDownRight className="w-4 h-4 text-orange-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatAmount = (amount: number, type: string) => {
    const sign = type === 'topup' || type === 'delivery_payment' ? '+' : '-';
    return `${sign}₹${Math.abs(amount).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-20 bg-muted rounded-lg mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Main Wallet Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wallet className="w-6 h-6 text-primary" />
              <span>Wallet</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowTransactionHistory(true)}
            >
              <History className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="text-center">
            <div className="mb-2">
              <span className="text-sm text-muted-foreground">Available Balance</span>
            </div>
            <div className="text-4xl font-bold text-foreground mb-4">
              ₹{walletData.balance.toFixed(2)}
            </div>
            
            {/* Additional balances */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <div className="text-xs text-orange-600 mb-1">Pending COD</div>
                <div className="text-lg font-semibold">₹{walletData.pending_cod_amount.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="text-xs text-green-600 mb-1">Total Collected</div>
                <div className="text-lg font-semibold">₹{walletData.total_collected.toFixed(2)}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <WalletActions showBalance={false} />
          </div>
          
          {/* Recent Transactions Preview */}
          {transactions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Recent Transactions</h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowTransactionHistory(true)}
                >
                  View All
                </Button>
              </div>
              <div className="space-y-2">
                {transactions.slice(0, 3).map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(txn.transaction_type)}
                      <div>
                        <p className="text-sm font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        txn.transaction_type === 'topup' || txn.transaction_type === 'delivery_payment' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {formatAmount(txn.amount, txn.transaction_type)}
                      </span>
                      {getStatusIcon(txn.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History Dialog */}
      <Dialog open={showTransactionHistory} onOpenChange={setShowTransactionHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <History className="w-5 h-5" />
              <span>Transaction History</span>
            </DialogTitle>
            <DialogDescription>
              View all your wallet transactions
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-3">
              {transactions.length > 0 ? (
                transactions.map((txn) => (
                  <div key={txn.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(txn.transaction_type)}
                        <div>
                          <p className="font-medium text-sm">{txn.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(txn.created_at).toLocaleString()}
                          </p>
                          {txn.settlement_reference && (
                            <p className="text-xs text-muted-foreground">
                              Ref: {txn.settlement_reference}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${
                          txn.transaction_type === 'topup' || txn.transaction_type === 'delivery_payment' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {formatAmount(txn.amount, txn.transaction_type)}
                        </div>
                        <div className="flex items-center space-x-1 mt-1">
                          {getStatusIcon(txn.status)}
                          <Badge 
                            variant={
                              txn.status === 'completed' ? 'default' : 
                              txn.status === 'pending' || txn.status === 'processing' ? 'secondary' : 
                              'destructive'
                            }
                            className="text-xs"
                          >
                            {txn.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-sm text-muted-foreground">Start by adding money to your wallet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletDisplay;