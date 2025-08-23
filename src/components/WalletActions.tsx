import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, Plus, Settings, CheckCircle, Building } from "lucide-react";

// Global declaration for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

// Utility to load Razorpay script on demand
async function loadRazorpay(): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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

interface AutopaySettings {
  is_enabled: boolean;
  topup_amount: number;
  minimum_balance: number;
}

interface WalletActionsProps {
  trigger?: React.ReactNode;
  showBalance?: boolean;
}

const WalletActions = ({ trigger, showBalance = false }: WalletActionsProps) => {
  const [showAddMoneyDialog, setShowAddMoneyDialog] = useState(false);
  const [showAutopayDialog, setShowAutopayDialog] = useState(false);
  const [showBankDetailsDialog, setShowBankDetailsDialog] = useState(false);
  const [topupAmount, setTopupAmount] = useState(500);
  const [topupLoading, setTopupLoading] = useState(false);
  const [autopayLoading, setAutopayLoading] = useState(false);
  const [agentId, setAgentId] = useState<string>('');
  const [bankDetails, setBankDetails] = useState<BankDetails[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [autopaySettings, setAutopaySettings] = useState<AutopaySettings>({
    is_enabled: false,
    topup_amount: 500,
    minimum_balance: 500
  });

  // Bank form state
  const [newBankDetails, setNewBankDetails] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'savings'
  });
  const [bankLoading, setBankLoading] = useState(false);

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
          fetchWalletData(agent.id),
          fetchAutopaySettings(agent.id)
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
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    }
  };

  const fetchAutopaySettings = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_autopay_settings')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAutopaySettings({
          is_enabled: data.is_enabled,
          topup_amount: data.topup_amount,
          minimum_balance: data.minimum_balance
        });
      }
    } catch (error) {
      console.error('Error fetching autopay settings:', error);
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
      console.log("Starting top-up process for amount:", topupAmount);
      
      const { data, error } = await supabase.functions.invoke('agent-topup-razorpay', {
        body: { amount: topupAmount }
      });

      console.log("Top-up response:", { data, error });

      if (error) {
        console.error("Top-up API error:", error);
        throw new Error(error.message || "Failed to create payment order");
      }

      if (!data?.success) {
        console.error("Top-up failed:", data);
        throw new Error(data?.error || "Failed to create payment order");
      }

      // Handle simulated payment (development mode)
      if (data.message?.includes("simulated")) {
        console.log("Simulated payment completed");
        toast({
          title: 'Success',
          description: data.message || 'Top-up completed successfully',
        });
        // Refresh wallet data and reset form
        if (agentId) {
          await fetchWalletData(agentId);
          setTopupAmount(500);
        }
        setShowAddMoneyDialog(false);
        return;
      }

      // If Razorpay order created, open Checkout
      if (data?.order_id && data?.key) {
        console.log("Loading Razorpay for order:", data.order_id);
        const loaded = await loadRazorpay();
        if (!loaded) {
          throw new Error('Failed to load Razorpay payment system');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const options: any = {
          key: data.key,
          amount: data.amount * 100,
          currency: data.currency || 'INR',
          name: 'Zaago Wallet',
          description: 'Wallet Top-up',
          order_id: data.order_id,
          prefill: {
            email: user?.email,
            contact: user?.phone
          },
          theme: {
            color: '#3B82F6'
          },
          handler: async (response: any) => {
            try {
              console.log('Payment success:', response);
              
              // Verify payment with backend
              const verifyResponse = await supabase.functions.invoke('agent-topup-verify', {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                }
              });

              if (verifyResponse.error) {
                throw new Error(verifyResponse.error.message);
              }

              toast({
                title: 'Payment Successful',
                description: `₹${topupAmount} has been added to your wallet`
              });

              // Refresh wallet data and reset form
              if (agentId) {
                await fetchWalletData(agentId);
                setTopupAmount(500);
              }
              setShowAddMoneyDialog(false);
              
            } catch (error) {
              console.error('Payment verification failed:', error);
              toast({
                title: 'Payment Error',
                description: 'Payment verification failed. Please contact support.',
                variant: 'destructive'
              });
            }
          },
          modal: {
            ondismiss: () => {
              console.log('Payment cancelled by user');
              setTopupLoading(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        
      } else {
        throw new Error("Unexpected response from payment service");
      }

    } catch (error: any) {
      console.error('Top-up error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process top-up. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTopupLoading(false);
    }
  };

  const handleAutopaySetup = async () => {
    if (!agentId || autopaySettings.topup_amount < 500 || autopaySettings.minimum_balance < 100) {
      toast({
        title: "Invalid Settings",
        description: "Minimum topup amount is ₹500 and minimum balance is ₹100",
        variant: "destructive"
      });
      return;
    }

    setAutopayLoading(true);
    
    try {
      console.log("Setting up autopay with Razorpay...");
      
      // First create/update autopay settings
      const { error: settingsError } = await supabase
        .from('agent_autopay_settings')
        .upsert({
          agent_id: agentId,
          is_enabled: true,
          topup_amount: autopaySettings.topup_amount,
          minimum_balance: autopaySettings.minimum_balance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'agent_id'
        });

      if (settingsError) throw settingsError;

      // Create Razorpay order for autopay setup
      const { data, error } = await supabase.functions.invoke('agent-topup-razorpay', {
        body: { 
          amount: autopaySettings.topup_amount,
          setup_autopay: true
        }
      });

      console.log("Autopay setup response:", { data, error });

      if (error) {
        console.error("Autopay setup API error:", error);
        throw new Error(error.message || "Failed to setup autopay");
      }

      if (!data?.success) {
        console.error("Autopay setup failed:", data);
        throw new Error(data?.error || "Failed to setup autopay");
      }

      // If Razorpay order created, open Checkout
      if (data?.order_id && data?.key) {
        console.log("Loading Razorpay for autopay setup:", data.order_id);
        const loaded = await loadRazorpay();
        if (!loaded) {
          throw new Error('Failed to load Razorpay payment system');
        }

        const { data: { user } } = await supabase.auth.getUser();

        const options: any = {
          key: data.key,
          amount: data.amount * 100,
          currency: data.currency || 'INR',
          name: 'Zaago Autopay Setup',
          description: `Autopay setup for ₹${autopaySettings.topup_amount}`,
          order_id: data.order_id,
          prefill: {
            email: user?.email,
            contact: user?.phone
          },
          theme: {
            color: '#3B82F6'
          },
          handler: async (response: any) => {
            try {
              console.log('Autopay setup success:', response);
              
              toast({
                title: 'Autopay Setup Successful',
                description: `Autopay has been enabled with ₹${autopaySettings.topup_amount} topup amount`
              });

              // Refresh settings and close dialog
              if (agentId) {
                await fetchAutopaySettings(agentId);
                await fetchWalletData(agentId);
              }
              setShowAutopayDialog(false);
              
            } catch (error) {
              console.error('Autopay setup verification failed:', error);
              toast({
                title: 'Setup Error',
                description: 'Autopay setup verification failed. Please contact support.',
                variant: 'destructive'
              });
            }
          },
          modal: {
            ondismiss: () => {
              console.log('Autopay setup dismissed');
              setAutopayLoading(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        
      } else {
        // Handle simulated setup
        toast({
          title: 'Autopay Enabled',
          description: `Autopay has been enabled with ₹${autopaySettings.topup_amount} topup amount`
        });
        setShowAutopayDialog(false);
      }

    } catch (error: any) {
      console.error('Autopay setup error:', error);
      toast({
        title: 'Autopay Setup Failed',
        description: error.message || 'Failed to setup autopay',
        variant: 'destructive'
      });
    } finally {
      setAutopayLoading(false);
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
      setShowBankDetailsDialog(false);
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

  return (
    <div className="space-y-4">
      {/* Wallet Balance Display */}
      {showBalance && walletData && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold">₹{walletData.balance.toFixed(2)}</p>
            </div>
            {autopaySettings.is_enabled && (
              <div className="text-right">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600">Autopay On</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <Button 
          className="flex-1"
          onClick={() => setShowAddMoneyDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Money
        </Button>
        
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => setShowAutopayDialog(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          {autopaySettings.is_enabled ? 'Manage Autopay' : 'Set Autopay'}
        </Button>
      </div>

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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMoneyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleTopUp} 
              disabled={topupLoading}
            >
              {topupLoading ? "Processing..." : "Add Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Autopay Setup Dialog */}
      <Dialog open={showAutopayDialog} onOpenChange={setShowAutopayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {autopaySettings.is_enabled ? 'Manage Autopay' : 'Set Up Autopay'}
            </DialogTitle>
            <DialogDescription>
              Automatically add money to your wallet when balance goes below threshold
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {autopaySettings.is_enabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200 font-medium">
                    Autopay is currently enabled
                  </span>
                </div>
                <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                  Current settings: Add ₹{autopaySettings.topup_amount} when balance goes below ₹{autopaySettings.minimum_balance}
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="topup-amount">Auto Topup Amount (₹)</Label>
              <Input
                id="topup-amount"
                type="number"
                min="500"
                step="100"
                value={autopaySettings.topup_amount}
                onChange={(e) => setAutopaySettings({
                  ...autopaySettings,
                  topup_amount: Number(e.target.value)
                })}
                placeholder="Enter amount (minimum ₹500)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This amount will be automatically added to your wallet
              </p>
            </div>
            
            <div>
              <Label htmlFor="minimum-balance">Minimum Balance Threshold (₹)</Label>
              <Input
                id="minimum-balance"
                type="number"
                min="100"
                step="50"
                value={autopaySettings.minimum_balance}
                onChange={(e) => setAutopaySettings({
                  ...autopaySettings,
                  minimum_balance: Number(e.target.value)
                })}
                placeholder="Enter threshold (minimum ₹100)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Autopay will trigger when your balance goes below this amount
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">How it works:</h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 mt-2 space-y-1">
                <li>• We'll monitor your wallet balance automatically</li>
                <li>• When balance drops below ₹{autopaySettings.minimum_balance}, we'll add ₹{autopaySettings.topup_amount}</li>
                <li>• Payment will be processed using Razorpay</li>
                <li>• You can disable autopay anytime from settings</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutopayDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAutopaySetup} 
              disabled={autopayLoading}
            >
              {autopayLoading ? 'Setting up...' : 'Confirm & Setup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bank Details Dialog */}
      <Dialog open={showBankDetailsDialog} onOpenChange={setShowBankDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Details</DialogTitle>
            <DialogDescription>
              Add your bank account for withdrawals and payouts
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankDetailsDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBankDetailsSubmit} 
              disabled={bankLoading}
            >
              {bankLoading ? "Adding..." : "Add Bank Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletActions;