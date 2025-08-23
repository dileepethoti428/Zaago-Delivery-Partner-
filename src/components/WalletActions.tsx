import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, Download, Building } from "lucide-react";

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

interface WalletActionsProps {
  trigger?: React.ReactNode;
  showBalance?: boolean;
}

const WalletActions = ({ trigger, showBalance = false }: WalletActionsProps) => {
  const [showAddMoneyDialog, setShowAddMoneyDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [topupAmount, setTopupAmount] = useState(500);
  const [withdrawalAmount, setWithdrawalAmount] = useState(500);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails[]>([]);
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 0,
    pending_cod_amount: 0,
    total_collected: 0
  });
  const [newBankDetails, setNewBankDetails] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'savings'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAgentData();
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
        await Promise.all([
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
      
      // Set default bank for withdrawal
      if (data && data.length > 0) {
        const primaryBank = data.find(bank => bank.is_primary) || data[0];
        setSelectedBankId(primaryBank.id);
      }
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
        setWithdrawalAmount(Math.min(data.balance, 500));
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  };

  const handleTopUp = async () => {
    if (!agentId || topupAmount < 500) {
      toast({
        title: "Invalid Amount",
        description: "Minimum top-up amount is ₹500",
        variant: "destructive"
      });
      return;
    }

    setTopupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-topup-razorpay', {
        body: { amount: topupAmount }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Razorpay payment in new tab
        window.open(data.url, '_blank');
        toast({
          title: "Payment Initiated",
          description: "Redirecting to payment gateway...",
        });
        setShowAddMoneyDialog(false);
      } else {
        toast({
          title: "Success",
          description: data?.message || "Top-up completed successfully",
        });
        await fetchWalletData(agentId);
        setShowAddMoneyDialog(false);
      }
    } catch (error: any) {
      console.error('Top-up error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process top-up",
        variant: "destructive"
      });
    } finally {
      setTopupLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!agentId || !selectedBankId || withdrawalAmount < 500) {
      toast({
        title: "Invalid Request",
        description: "Please select a bank account and enter minimum ₹500",
        variant: "destructive"
      });
      return;
    }

    if (withdrawalAmount > walletData.balance) {
      toast({
        title: "Insufficient Balance",
        description: "Withdrawal amount exceeds wallet balance",
        variant: "destructive"
      });
      return;
    }

    setWithdrawalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-bank-transfer', {
        body: {
          agent_id: agentId,
          amount: withdrawalAmount,
          bank_id: selectedBankId
        }
      });

      if (error) throw error;

      toast({
        title: "Transfer Completed",
        description: data?.message || `₹${withdrawalAmount} sent to your bank account`,
      });

      await fetchWalletData(agentId);
      setShowWithdrawDialog(false);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive"
      });
    } finally {
      setWithdrawalLoading(false);
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

  const defaultTrigger = (
    <Button variant="outline" className="flex items-center space-x-2">
      <Wallet className="w-4 h-4" />
      <span>Wallet</span>
    </Button>
  );

  return (
    <>
      {/* Wallet Balance Display */}
      {showBalance && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-primary/10 rounded-lg mb-4">
          <Wallet className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold">₹{walletData.balance.toFixed(2)}</span>
        </div>
      )}

      {/* Action Buttons */}
      <Button 
        className="flex items-center space-x-2 w-full" 
        onClick={() => setShowAddMoneyDialog(true)}
      >
        <Plus className="w-4 h-4" />
        <span>Add Money</span>
      </Button>
      
      <Button 
        variant="outline" 
        className="flex items-center space-x-2 w-full"
        disabled={bankDetails.length === 0 || walletData.balance < 500}
        onClick={() => setShowWithdrawDialog(true)}
      >
        <Download className="w-4 h-4" />
        <span>Withdraw</span>
      </Button>

      {/* Add Money Dialog */}
      <Dialog open={showAddMoneyDialog} onOpenChange={setShowAddMoneyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Money to Wallet</DialogTitle>
            <DialogDescription>
              Add money to your wallet using secure payment methods (Minimum ₹500)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topup-amount">Enter Amount (₹)</Label>
              <Input
                id="topup-amount"
                type="number"
                min="500"
                value={topupAmount}
                onChange={(e) => setTopupAmount(Number(e.target.value))}
                placeholder="Enter amount"
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={() => setTopupAmount(500)} variant="outline" size="sm">₹500</Button>
              <Button onClick={() => setTopupAmount(1000)} variant="outline" size="sm">₹1000</Button>
              <Button onClick={() => setTopupAmount(2000)} variant="outline" size="sm">₹2000</Button>
            </div>
            <Button 
              onClick={handleTopUp} 
              disabled={topupLoading}
              className="w-full"
            >
              {topupLoading ? "Processing..." : "Add Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Money Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Money</DialogTitle>
            <DialogDescription>
              Transfer money directly to your bank account (Minimum ₹500)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdrawal-amount">Enter Amount to Withdraw (₹)</Label>
              <Input
                id="withdrawal-amount"
                type="number"
                min="500"
                max={walletData.balance}
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available balance: ₹{walletData.balance.toFixed(2)}
              </p>
            </div>
            
            {bankDetails.length > 0 ? (
              <div>
                <Label htmlFor="bank-select">Select Bank Account</Label>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankDetails.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.bank_name} - ••••{bank.account_number.slice(-4)}
                        {bank.is_primary && " (Primary)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-center p-4 bg-muted rounded-lg">
                <Building className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">No bank accounts added</p>
                <Button onClick={() => setShowBankDialog(true)} variant="outline" size="sm">
                  Add Bank Account
                </Button>
              </div>
            )}

            <Button 
              onClick={handleWithdrawal} 
              disabled={withdrawalLoading || !selectedBankId}
              className="w-full"
            >
              {withdrawalLoading ? "Processing..." : "Withdraw"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Bank Details Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Details</DialogTitle>
            <DialogDescription>
              Add your bank account for withdrawals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                value={newBankDetails.bank_name}
                onChange={(e) => setNewBankDetails(prev => ({...prev, bank_name: e.target.value}))}
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <Label htmlFor="account-holder">Account Holder Name</Label>
              <Input
                id="account-holder"
                value={newBankDetails.account_holder_name}
                onChange={(e) => setNewBankDetails(prev => ({...prev, account_holder_name: e.target.value}))}
                placeholder="Enter account holder name"
              />
            </div>
            <div>
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                value={newBankDetails.account_number}
                onChange={(e) => setNewBankDetails(prev => ({...prev, account_number: e.target.value}))}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <Label htmlFor="ifsc-code">IFSC Code</Label>
              <Input
                id="ifsc-code"
                value={newBankDetails.ifsc_code}
                onChange={(e) => setNewBankDetails(prev => ({...prev, ifsc_code: e.target.value.toUpperCase()}))}
                placeholder="Enter IFSC code"
              />
            </div>
            <div>
              <Label htmlFor="account-type">Account Type</Label>
              <Select value={newBankDetails.account_type} onValueChange={(value) => setNewBankDetails(prev => ({...prev, account_type: value}))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleBankDetailsSubmit} 
              disabled={bankLoading}
              className="w-full"
            >
              {bankLoading ? "Adding..." : "Add Bank Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletActions;