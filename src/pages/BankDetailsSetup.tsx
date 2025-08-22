import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  CreditCard, 
  Building,
  ArrowRight,
  Shield,
  CheckCircle
} from "lucide-react";

const BankDetailsSetup = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'savings'
  });

  useEffect(() => {
    checkAgentAndExistingDetails();
  }, []);

  const checkAgentAndExistingDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        navigate('/login');
        return;
      }

      // Get agent ID
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id, name')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        toast({
          title: "Agent Profile Not Found",
          description: "Please contact support to activate your account.",
          variant: "destructive"
        });
        navigate('/login');
        return;
      }

      setAgentId(agent.id);
      setBankDetails(prev => ({ ...prev, account_holder_name: agent.name || '' }));

      // Check if bank details already exist
      const { data: existingBank } = await supabase
        .from('agent_bank_details')
        .select('id')
        .eq('agent_id', agent.id)
        .maybeSingle();

      if (existingBank) {
        // Already has bank details, redirect to home
        navigate('/home');
      }
    } catch (error) {
      console.error('Error checking agent details:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { bank_name, account_holder_name, account_number, ifsc_code } = bankDetails;
    
    if (!bank_name.trim()) {
      toast({
        title: "Bank name is required",
        variant: "destructive"
      });
      return false;
    }

    if (!account_holder_name.trim()) {
      toast({
        title: "Account holder name is required",
        variant: "destructive"
      });
      return false;
    }

    if (!account_number.trim() || account_number.length < 9) {
      toast({
        title: "Valid account number is required",
        variant: "destructive"
      });
      return false;
    }

    if (!ifsc_code.trim() || ifsc_code.length !== 11) {
      toast({
        title: "Valid IFSC code is required (11 characters)",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!agentId || !validateForm()) return;

    setLoading(true);
    try {
      // Insert bank details
      const { error } = await supabase
        .from('agent_bank_details')
        .insert({
          agent_id: agentId,
          ...bankDetails,
          is_primary: true,
          is_verified: false
        });

      if (error) throw error;

      // Initialize agent wallet
      await supabase
        .from('agent_wallet')
        .upsert({
          agent_id: agentId,
          balance: 0,
          pending_cod_amount: 0,
          total_collected: 0
        }, {
          onConflict: 'agent_id'
        });

      toast({
        title: "Bank Details Saved",
        description: "Your account setup is complete! Welcome to Zaago.",
      });

      // Redirect to home
      navigate('/home');
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast({
        title: "Error",
        description: "Failed to save bank details. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const skipForNow = () => {
    toast({
      title: "Bank details skipped",
      description: "You can add them later in settings.",
    });
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Setup Bank Details</h1>
          <p className="text-muted-foreground mt-2">
            Add your bank account to receive payments from deliveries
          </p>
        </div>

        {/* Bank Details Form */}
        <Card className="bg-card border-border animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-primary" />
              <span>Bank Account Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bank_name">Bank Name *</Label>
              <Input
                id="bank_name"
                value={bankDetails.bank_name}
                onChange={(e) => handleInputChange('bank_name', e.target.value)}
                placeholder="e.g., State Bank of India"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="account_holder_name">Account Holder Name *</Label>
              <Input
                id="account_holder_name"
                value={bankDetails.account_holder_name}
                onChange={(e) => handleInputChange('account_holder_name', e.target.value)}
                placeholder="As per bank records"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={bankDetails.account_number}
                onChange={(e) => handleInputChange('account_number', e.target.value)}
                placeholder="Enter your account number"
                className="mt-1"
                type="number"
              />
            </div>

            <div>
              <Label htmlFor="ifsc_code">IFSC Code *</Label>
              <Input
                id="ifsc_code"
                value={bankDetails.ifsc_code}
                onChange={(e) => handleInputChange('ifsc_code', e.target.value.toUpperCase())}
                placeholder="e.g., SBIN0001234"
                className="mt-1"
                maxLength={11}
              />
            </div>

            <div>
              <Label htmlFor="account_type">Account Type</Label>
              <Select 
                value={bankDetails.account_type} 
                onValueChange={(value) => handleInputChange('account_type', value)}
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
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card className="bg-primary/5 border-primary/20 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Secure & Encrypted</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Your bank details are encrypted and stored securely. We use bank-grade security to protect your information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3 animate-slide-up">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
          >
            {loading ? (
              <>Setting up...</>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={skipForNow}
            disabled={loading}
            className="w-full"
          >
            Skip for Now
          </Button>
        </div>

        {/* Benefits */}
        <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-4">
            <h4 className="font-semibold text-foreground mb-3">Why add bank details now?</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-muted-foreground">Instant payment processing</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-muted-foreground">Automatic weekly payouts</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm text-muted-foreground">Access to bonus programs</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BankDetailsSetup;