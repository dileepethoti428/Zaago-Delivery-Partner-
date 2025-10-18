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
        const { data, error } = await supabase.functions.invoke('check-flexible-payment-status', {
          body: { payment_id: paymentId }
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
    try {
      const { data, error } = await supabase.functions.invoke('generate-flexible-payment-qr', {
        body: { agent_id: agentId, amount: amountNum }
      });

      if (error) throw error;

      if (data?.success) {
        setQrCodeUrl(data.qr_code_url);
        setPaymentId(data.payment_id);
        setExpiresAt(data.expires_at);
        toast.success("QR code generated successfully!");
      } else {
        throw new Error(data?.error || "Failed to generate QR code");
      }
    } catch (error: any) {
      console.error('Error generating QR:', error);
      toast.error(error.message || "Failed to generate QR code");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
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
                <Label htmlFor="amount">Enter Amount (₹10 - ₹50,000)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10"
                  max="50000"
                  disabled={loading}
                />
              </div>

              <Button 
                onClick={handleGenerateQR} 
                disabled={loading || !amount}
                className="w-full bg-blue-600 hover:bg-blue-700"
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
            <div className="space-y-4">
              {/* Payment Status */}
              {isPaid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-semibold">Payment Received!</p>
                  <p className="text-green-700 text-sm">₹{amount} credited to your wallet</p>
                </div>
              ) : (
                <>
                  {/* Timer */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-800">Expires in:</span>
                    </div>
                    <span className="text-lg font-semibold text-orange-900">
                      {formatTime(timeLeft)}
                    </span>
                  </div>

                  {/* Amount Display */}
                  <div className="text-center py-2">
                    <p className="text-sm text-gray-600">Amount to collect</p>
                    <p className="text-3xl font-bold text-gray-900">₹{amount}</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                    <img 
                      src={qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-full max-w-[280px] mx-auto"
                    />
                  </div>

                  {/* UPI Apps */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">Scan with any UPI app</p>
                    <div className="flex justify-center gap-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">GPay</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">PhonePe</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">Paytm</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">BHIM</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
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
                className="w-full"
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
