import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Loader2, CheckCircle, Clock, AlertCircle, Wallet, Zap, XCircle } from "lucide-react";

interface FlexiblePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

type PaymentStatus = 'idle' | 'creating' | 'generating' | 'pending' | 'paid' | 'expired' | 'failed';

export const FlexiblePaymentDialog = ({ open, onOpenChange, agentId }: FlexiblePaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAmount("");
      setStatus('idle');
      setRequestId(null);
      setQrCodeUrl("");
      setPaymentId("");
      setExpiresAt("");
      setTimeLeft(0);
      setWalletBalance(null);
      setErrorMessage(null);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || status === 'paid' || status === 'expired') return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && status === 'pending') {
        setStatus('expired');
        clearInterval(interval);
        toast.error("QR code expired");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, status]);

  // Poll payment request status (for QR generation) with fallback
  useEffect(() => {
    if (!requestId || status !== 'generating') return;

    console.log('🔍 Polling payment request:', requestId);
    
    let pollCount = 0;
    const maxPollsBeforeFallback = 5; // Wait 5 seconds before fallback

    const pollRequest = async () => {
      try {
        pollCount++;
        
        const { data, error } = await supabase
          .from('flexible_payment_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (error) {
          console.error('❌ Poll error:', error);
          return;
        }

        console.log(`📊 Request status (poll ${pollCount}):`, data.status);

        if (data.status === 'generated') {
          console.log('✅ QR generated!');
          setStatus('pending');
          setQrCodeUrl(data.qr_url);
          setPaymentId(data.payment_id);
          setExpiresAt(data.expires_at);
        } else if (data.status === 'failed') {
          console.error('❌ QR generation failed:', data.error_message);
          setStatus('failed');
          setErrorMessage(data.error_message || 'Failed to generate QR code');
          toast.error(data.error_message || 'Failed to generate QR code');
        } else if (pollCount === maxPollsBeforeFallback && data.status === 'pending') {
          // Trigger hasn't fired, call edge function directly as fallback
          console.log('🔄 Trigger delay detected, calling edge function directly...');
          
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke(
              'process-flexible-payment-request',
              { body: { request_id: requestId } }
            );

            if (fnError) {
              console.error('❌ Fallback call error:', fnError);
              throw fnError;
            }

            console.log('✅ Fallback call successful:', fnData);
            
            // Success response from edge function
            if (fnData?.success && fnData?.qr_url) {
              setQrCodeUrl(fnData.qr_url);
              setPaymentId(fnData.payment_id);
              setStatus('pending');
              setExpiresAt(data.expires_at); // Use updated expiry from DB
              toast.success('QR code generated!');
            }
          } catch (err: any) {
            console.error('❌ Fallback failed:', err);
            setStatus('failed');
            setErrorMessage(err.message || 'Failed to generate QR code');
            toast.error(err.message || 'Failed to generate QR code');
          }
        }
      } catch (error) {
        console.error('❌ Poll exception:', error);
      }
    };

    // Poll every second
    const interval = setInterval(pollRequest, 1000);
    
    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      if (status === 'generating') {
        setStatus('failed');
        setErrorMessage('QR generation timed out');
        toast.error('QR generation took too long. Please try again.');
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [requestId, status]);

  // Poll payment status (for payment confirmation)
  useEffect(() => {
    if (!paymentId || status !== 'pending') return;

    console.log('💳 Starting payment polling for:', paymentId);
    let pollCount = 0;
    const maxPolls = 600;

    const pollPayment = async () => {
      try {
        pollCount++;
        console.log(`Polling ${pollCount}/${maxPolls}`);
        
        const { data, error } = await supabase.functions.invoke('check-flexible-payment-status', {
          body: { payment_id: paymentId }
        });

        if (error) {
          console.error('❌ Payment check error:', error);
          return;
        }

        console.log('💰 Payment status:', data?.status);

        if (data?.success && data?.isPaid) {
          console.log('✅ Payment confirmed!');
          setStatus('paid');
          setWalletBalance(data.wallet_balance);
          toast.success("Payment Received!", {
            description: `₹${amount} credited to your wallet`
          });
          
          setTimeout(() => onOpenChange(false), 4000);
        } else if (data?.status === 'expired') {
          setStatus('expired');
          toast.error("QR code expired");
        }
      } catch (error) {
        console.error('❌ Payment poll error:', error);
      }
    };

    const initialTimer = setTimeout(pollPayment, 3000);
    const interval = setInterval(() => {
      if (pollCount >= maxPolls) {
        clearInterval(interval);
        return;
      }
      pollPayment();
    }, 3000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [paymentId, status, amount, onOpenChange]);

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

    setStatus('creating');
    setErrorMessage(null);
    console.log('💳 Creating payment request for ₹', amountNum);

    try {
      // Insert into flexible_payment_requests table
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 15);

      const { data, error } = await supabase
        .from('flexible_payment_requests')
        .insert({
          agent_id: agentId,
          amount: amountNum,
          expires_at: expiryTime.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create request:', error);
        throw error;
      }

      console.log('✅ Payment request created:', data.id);
      setRequestId(data.id);
      setStatus('generating');

      // Database trigger will automatically process the request
      console.log('🔄 Database trigger will process request:', data.id);

      toast.success("Generating QR code...");
    } catch (error: any) {
      console.error('❌ Failed to create request:', error);
      setStatus('failed');
      setErrorMessage(error.message);
      toast.error(error.message || "Failed to create payment request");
    }
  };

  const handleReset = () => {
    setQrCodeUrl("");
    setPaymentId("");
    setExpiresAt("");
    setAmount("");
    setStatus('idle');
    setRequestId(null);
    setWalletBalance(null);
    setErrorMessage(null);
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
            <Zap className="w-5 h-5 text-primary" />
            Add Money to Wallet
          </DialogTitle>
          <DialogDescription>
            Generate a UPI QR code to add money instantly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'idle' || status === 'creating' ? (
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
                  disabled={status === 'creating'}
                  className="text-lg"
                />
              </div>

              <Button 
                onClick={handleGenerateQR} 
                disabled={status === 'creating' || !amount}
                className="w-full"
                size="lg"
              >
                {status === 'creating' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </>
          ) : status === 'generating' ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Generating QR Code...</p>
                <p className="text-sm text-muted-foreground">This will only take a moment</p>
              </div>
            </div>
          ) : status === 'failed' ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-destructive">Failed to Generate QR</p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
              <Button onClick={handleReset} variant="outline" className="mt-4">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment Status */}
              {status === 'paid' ? (
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
              ) : status === 'expired' ? (
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
                </>
              )}

              {/* Action Button */}
              <Button 
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                {status === 'paid' || status === 'expired' ? 'Create New QR' : 'Cancel & Create New'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
