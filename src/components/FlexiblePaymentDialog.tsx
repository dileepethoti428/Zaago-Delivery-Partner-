import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Loader2, CheckCircle, Clock } from "lucide-react";

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

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAmount("");
      setQrCodeUrl("");
      setPaymentId("");
      setExpiresAt("");
      setIsPaid(false);
      setTimeLeft(0);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        toast.error("QR code expired. Please generate a new one.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Poll for payment status
  useEffect(() => {
    if (!paymentId || isPaid) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const { data, error } = await supabase.functions.invoke('check-flexible-payment-status', {
          body: { payment_id: paymentId },
          headers: session?.access_token ? {
            Authorization: `Bearer ${session.access_token}`
          } : {}
        });

        if (error) throw error;

        if (data?.isPaid) {
          setIsPaid(true);
          toast.success("Payment received! ₹" + amount + " credited to your wallet.");
          setTimeout(() => {
            onOpenChange(false);
          }, 3000);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [paymentId, isPaid, amount, onOpenChange]);

  const handleGenerateQR = async () => {
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum < 10 || amountNum > 50000) {
      toast.error("Please enter an amount between ₹10 and ₹50,000");
      return;
    }

    setLoading(true);
    
    // Set a timeout to catch hanging requests
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Request timeout after 15 seconds');
      toast.error("Request timeout. Please check your connection and try again.");
      setLoading(false);
    }, 15000);

    try {
      // Validate session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        throw new Error('Authentication error. Please log in again.');
      }
      
      if (!session?.access_token) {
        throw new Error('No valid session. Please log in again.');
      }

      console.log('🔵 Generating flexible payment QR');
      console.log('🔵 Agent ID:', agentId);
      console.log('🔵 Amount:', amountNum);
      console.log('🔵 Session valid:', !!session.access_token);

      const { data, error } = await supabase.functions.invoke('generate-flexible-payment-qr', {
        body: { 
          agent_id: agentId, 
          amount: amountNum 
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      console.log('📡 Function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to generate QR code');
      }

      if (!data) {
        throw new Error('No response from server');
      }

      if (data.success) {
        console.log('✅ QR generated successfully');
        setQrCodeUrl(data.qr_code_url);
        setPaymentId(data.payment_id);
        setExpiresAt(data.expires_at);
        toast.success("QR code generated successfully!");
      } else {
        console.error('❌ QR generation failed:', data);
        throw new Error(data.error || "Failed to generate QR code");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('❌ Complete error object:', error);
      
      let errorMessage = "Failed to generate QR code. ";
      
      if (error.message) {
        errorMessage += error.message;
      } else if (error.status === 401) {
        errorMessage += "Authentication failed. Please log in again.";
      } else if (error.status >= 500) {
        errorMessage += "Server error. Please try again later.";
      } else if (!navigator.onLine) {
        errorMessage += "No internet connection.";
      } else {
        errorMessage += "Please try again.";
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-4 h-4 text-blue-600" />
            Flexible Payment QR
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate a QR code for customers to pay any amount via UPI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!qrCodeUrl ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm">Enter Amount (₹10 - ₹50,000)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10"
                  max="50000"
                  disabled={loading}
                  className="h-9"
                />
              </div>

              <Button 
                onClick={handleGenerateQR} 
                disabled={loading || !amount}
                className="w-full bg-blue-600 hover:bg-blue-700 h-9"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating QR...
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
            <div className="space-y-3">
              {/* Payment Status */}
              {isPaid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-1" />
                  <p className="text-green-800 font-semibold text-sm">Payment Received!</p>
                  <p className="text-green-700 text-xs">₹{amount} credited to your wallet</p>
                </div>
              ) : (
                <>
                  {/* Timer */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-orange-600" />
                      <span className="text-xs text-orange-800">Expires in:</span>
                    </div>
                    <span className="text-base font-semibold text-orange-900">
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  {/* Amount Display */}
                  <div className="text-center py-1">
                    <p className="text-xs text-gray-600">Amount to collect</p>
                    <p className="text-2xl font-bold text-gray-900">₹{amount}</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-3">
                    <img 
                      src={qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-full max-w-[220px] mx-auto"
                    />
                  </div>

                  {/* UPI Apps */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1.5">Scan with any UPI app</p>
                    <div className="flex justify-center gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">GPay</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">PhonePe</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Paytm</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">BHIM</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Waiting for payment...
                  </div>
                </>
              )}

              {/* Generate New Button */}
              <Button 
                onClick={() => {
                  setQrCodeUrl("");
                  setPaymentId("");
                  setExpiresAt("");
                  setAmount("");
                  setIsPaid(false);
                }}
                variant="outline"
                className="w-full h-9"
              >
                Generate New QR
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
