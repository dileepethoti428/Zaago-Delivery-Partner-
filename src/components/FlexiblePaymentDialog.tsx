import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Loader2, CheckCircle, Clock, AlertCircle, Wallet } from "lucide-react";

interface FlexiblePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export const FlexiblePaymentDialog = ({ open, onOpenChange, agentId }: FlexiblePaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pollingError, setPollingError] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAmount("");
      setQrCodeUrl("");
      setPaymentId("");
      setExpiresAt("");
      setIsPaid(false);
      setTimeLeft(0);
      setIsExpired(false);
      setWalletBalance(null);
      setPollingError(false);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || isPaid) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && !isExpired) {
        setIsExpired(true);
        clearInterval(interval);
        toast.error("QR code expired", {
          description: "Please generate a new QR code"
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isPaid, isExpired]);

  // Poll for payment status
  useEffect(() => {
    if (!paymentId || isPaid || isExpired) return;

    let pollCount = 0;
    const maxPolls = 600; // 30 minutes at 3s intervals

    const pollInterval = setInterval(async () => {
      pollCount++;
      
      if (pollCount > maxPolls) {
        console.log('⏱️ Max polling attempts reached');
        clearInterval(pollInterval);
        return;
      }

      try {
        console.log(`🔄 Polling payment status (${pollCount}/${maxPolls})`);
        
        const { data, error } = await supabase.functions.invoke('check-flexible-payment-status', {
          body: { payment_id: paymentId }
        });

        if (error) {
          console.error('❌ Status check error:', error);
          setPollingError(true);
          return;
        }

        // Clear any previous errors
        if (pollingError) {
          setPollingError(false);
        }

        if (data?.success && data?.isPaid) {
          console.log('✅ Payment confirmed!');
          setIsPaid(true);
          setWalletBalance(data.wallet_balance);
          clearInterval(pollInterval);
          
          toast.success("Payment Received!", {
            description: `₹${amount} credited to your wallet`,
            duration: 5000
          });

          // Auto-close after 4 seconds
          setTimeout(() => {
            onOpenChange(false);
          }, 4000);
        } else if (data?.status === 'expired') {
          console.log('⏱️ Payment expired');
          setIsExpired(true);
          clearInterval(pollInterval);
          toast.error("QR code expired");
        }
      } catch (error) {
        console.error('❌ Error checking payment:', error);
        setPollingError(true);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [paymentId, isPaid, isExpired, amount, onOpenChange, pollingError]);

  const handleGenerateQR = async () => {
    const amountNum = parseFloat(amount);

    if (!amountNum || isNaN(amountNum)) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amountNum < 10) {
      toast.error("Minimum amount is ₹10");
      return;
    }

    if (amountNum > 50000) {
      toast.error("Maximum amount is ₹50,000");
      return;
    }

    setLoading(true);
    setPollingError(false);

    try {
      console.log('🔵 Generating flexible payment QR:', { agentId, amount: amountNum });

      const { data, error } = await supabase.functions.invoke('generate-flexible-payment-qr', {
        body: { 
          agent_id: agentId, 
          amount: amountNum 
        }
      });

      if (error) {
        console.error('❌ Function error:', error);
        throw new Error(error.message || 'Failed to generate QR code');
      }

      if (!data?.success) {
        console.error('❌ API error:', data);
        throw new Error(data?.error || 'Failed to generate QR code');
      }

      console.log('✅ QR code generated:', data);
      
      setQrCodeUrl(data.qr_code_url);
      setPaymentId(data.payment_id);
      setExpiresAt(data.expires_at);
      
      toast.success("QR Code Ready", {
        description: "Show this QR code to your customer"
      });
      
    } catch (error: any) {
      console.error('❌ Generation error:', error);
      toast.error("Failed to generate QR", {
        description: error.message || "Please try again"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQrCodeUrl("");
    setPaymentId("");
    setExpiresAt("");
    setAmount("");
    setIsPaid(false);
    setIsExpired(false);
    setWalletBalance(null);
    setPollingError(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Flexible Payment QR
          </DialogTitle>
          <DialogDescription>
            Generate a QR code for customers to pay any amount via UPI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!qrCodeUrl ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹10 - ₹50,000)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10"
                  max="50000"
                  step="1"
                  disabled={loading}
                  className="text-lg"
                />
              </div>

              <Button 
                onClick={handleGenerateQR} 
                disabled={loading || !amount}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Payment Status */}
              {isPaid ? (
                <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-lg p-4 text-center space-y-2">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <div>
                    <p className="text-green-900 dark:text-green-100 font-semibold text-lg">
                      Payment Received!
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      ₹{amount} credited to wallet
                    </p>
                    {walletBalance !== null && (
                      <div className="flex items-center justify-center gap-2 mt-2 text-green-800 dark:text-green-200">
                        <Wallet className="w-4 h-4" />
                        <span className="text-sm">New balance: ₹{walletBalance.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : isExpired ? (
                <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-500 rounded-lg p-4 text-center space-y-2">
                  <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                  <div>
                    <p className="text-red-900 dark:text-red-100 font-semibold">
                      QR Code Expired
                    </p>
                    <p className="text-red-700 dark:text-red-300 text-sm">
                      Please generate a new QR code
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Timer */}
                  <div className={`rounded-lg p-3 flex items-center justify-between ${
                    timeLeft < 60 
                      ? 'bg-red-50 dark:bg-red-950/20 border-2 border-red-500' 
                      : 'bg-orange-50 dark:bg-orange-950/20 border border-orange-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${timeLeft < 60 ? 'text-red-600' : 'text-orange-600'}`} />
                      <span className={`text-sm ${timeLeft < 60 ? 'text-red-900 dark:text-red-100' : 'text-orange-900 dark:text-orange-100'}`}>
                        Expires in:
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${timeLeft < 60 ? 'text-red-900 dark:text-red-100' : 'text-orange-900 dark:text-orange-100'}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  {/* Amount Display */}
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">Amount to collect</p>
                    <p className="text-3xl font-bold">₹{amount}</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white dark:bg-gray-900 border-2 rounded-lg p-4">
                    <img 
                      src={qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-full max-w-[240px] mx-auto"
                    />
                  </div>

                  {/* UPI Apps */}
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Scan with any UPI app</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                        <span key={app} className="text-xs bg-secondary px-3 py-1 rounded-full">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Waiting for payment...
                  </div>

                  {/* Polling Error */}
                  {pollingError && (
                    <div className="text-center text-xs text-amber-600 dark:text-amber-400">
                      Having trouble checking status. Payment will still be processed if successful.
                    </div>
                  )}
                </>
              )}

              {/* Action Button */}
              <Button 
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                {isPaid || isExpired ? 'Create New QR' : 'Cancel & Create New'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};