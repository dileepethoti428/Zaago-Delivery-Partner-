import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  Plus,
  Building,
  Wallet,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Edit
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BankDetails {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type: string;
  is_verified: boolean;
  is_primary: boolean;
}

interface WalletData {
  balance: number;
  pending_cod_amount: number;
  total_collected: number;
  last_settlement_date: string | null;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  status: string;
}

const PayoutSettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankDetails, setNewBankDetails] = useState({
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder_name: '',
    account_type: 'savings'
  });

  useEffect(() => {
    fetchAgentData();
  }, []);

  const fetchAgentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent ID
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        setAgentId(agent.id);
        await Promise.all([
          fetchBankDetails(agent.id),
          fetchWalletData(agent.id),
          fetchTransactions(agent.id)
        ]);
      }
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  const fetchBankDetails = async (agentId: string) => {
    const { data, error } = await supabase
      .from('agent_bank_details')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bank details:', error);
      return;
    }

    setBankDetails(data || []);
  };

  const fetchWalletData = async (agentId: string) => {
    const { data, error } = await supabase
      .from('agent_wallet')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet data:', error);
      return;
    }

    setWalletData(data);
  };

  const fetchTransactions = async (agentId: string) => {
    const { data, error } = await supabase
      .from('agent_wallet_transactions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data || []);
  };

  const addBankAccount = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('agent_bank_details')
        .insert({
          agent_id: agentId,
          ...newBankDetails,
          is_primary: bankDetails.length === 0 // First account is primary
        });

      if (error) throw error;

      await fetchBankDetails(agentId);
      setShowAddBank(false);
      setNewBankDetails({
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        account_holder_name: '',
        account_type: 'savings'
      });

      toast({
        title: "Bank Account Added",
        description: "Your bank account has been added successfully.",
      });
    } catch (error) {
      console.error('Error adding bank account:', error);
      toast({
        title: "Error",
        description: "Failed to add bank account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const settleCOD = async () => {
    if (!agentId || !walletData?.pending_cod_amount) return;

    setLoading(true);
    try {
      // Create settlement transaction
      const { error: transactionError } = await supabase
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agentId,
          transaction_type: 'settlement',
          amount: -walletData.pending_cod_amount,
          description: 'COD settlement to company',
          status: 'completed'
        });

      if (transactionError) throw transactionError;

      // Update wallet
      const { error: walletError } = await supabase
        .from('agent_wallet')
        .upsert({
          agent_id: agentId,
          balance: (walletData.balance || 0) - walletData.pending_cod_amount,
          pending_cod_amount: 0,
          total_collected: (walletData.total_collected || 0) + walletData.pending_cod_amount,
          last_settlement_date: new Date().toISOString()
        }, {
          onConflict: 'agent_id'
        });

      if (walletError) throw walletError;

      await Promise.all([
        fetchWalletData(agentId),
        fetchTransactions(agentId)
      ]);

      toast({
        title: "COD Settled",
        description: `₹${walletData.pending_cod_amount.toFixed(2)} has been settled with the company.`,
      });
    } catch (error) {
      console.error('Error settling COD:', error);
      toast({
        title: "Error",
        description: "Failed to settle COD amount. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'cod_collected':
        return <ArrowUpRight className="w-4 h-4 text-success" />;
      case 'settlement':
        return <ArrowDownLeft className="w-4 h-4 text-warning" />;
      case 'payout':
        return <DollarSign className="w-4 h-4 text-primary" />;
      default:
        return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 animate-fade-in">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payout Settings</h1>
          <p className="text-muted-foreground">Manage your payment methods and wallet</p>
        </div>
      </div>

      {/* Wallet Overview */}
      {walletData && (
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 animate-slide-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Wallet className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Agent Wallet</h3>
              </div>
              <Badge className="bg-primary text-primary-foreground">Active</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-foreground">₹{walletData.balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Pending COD</p>
                <p className="text-2xl font-bold text-warning">₹{walletData.pending_cod_amount?.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            {walletData.pending_cod_amount > 0 && (
              <Button
                onClick={settleCOD}
                disabled={loading}
                className="w-full mt-4 bg-gradient-neon hover:shadow-neon"
              >
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Settle COD Amount
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bank Accounts */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-primary" />
            <span>Bank Accounts</span>
          </CardTitle>
          
          <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={newBankDetails.bank_name}
                    onChange={(e) => setNewBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="e.g., State Bank of India"
                  />
                </div>
                <div>
                  <Label htmlFor="account_holder_name">Account Holder Name</Label>
                  <Input
                    id="account_holder_name"
                    value={newBankDetails.account_holder_name}
                    onChange={(e) => setNewBankDetails(prev => ({ ...prev, account_holder_name: e.target.value }))}
                    placeholder="As per bank records"
                  />
                </div>
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={newBankDetails.account_number}
                    onChange={(e) => setNewBankDetails(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="Enter account number"
                  />
                </div>
                <div>
                  <Label htmlFor="ifsc_code">IFSC Code</Label>
                  <Input
                    id="ifsc_code"
                    value={newBankDetails.ifsc_code}
                    onChange={(e) => setNewBankDetails(prev => ({ ...prev, ifsc_code: e.target.value.toUpperCase() }))}
                    placeholder="e.g., SBIN0001234"
                  />
                </div>
                <Button 
                  onClick={addBankAccount} 
                  disabled={loading || !newBankDetails.bank_name || !newBankDetails.account_number}
                  className="w-full"
                >
                  Add Bank Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankDetails.length === 0 ? (
            <div className="text-center py-8">
              <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-semibold text-foreground mb-2">No Bank Accounts</h4>
              <p className="text-muted-foreground">Add a bank account to receive payouts</p>
            </div>
          ) : (
            bankDetails.map((bank) => (
              <div key={bank.id} className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-smooth">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{bank.bank_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        **** **** **** {bank.account_number.slice(-4)}
                      </p>
                      <p className="text-xs text-muted-foreground">{bank.account_holder_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {bank.is_primary && (
                      <Badge className="bg-success text-success-foreground">Primary</Badge>
                    )}
                    {bank.is_verified ? (
                      <Check className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-success" />
            <span>Recent Transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-semibold text-foreground mb-2">No Transactions</h4>
              <p className="text-muted-foreground">Your transaction history will appear here</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-secondary rounded-lg">
                    {getTransactionIcon(transaction.transaction_type)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground capitalize">
                      {transaction.transaction_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.amount > 0 ? 'text-success' : 'text-warning'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount).toFixed(2)}
                  </p>
                  <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                    {transaction.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoutSettings;