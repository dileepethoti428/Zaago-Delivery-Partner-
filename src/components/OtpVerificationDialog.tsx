import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, CheckCircle2, XCircle, Clock, Package, User, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OtpVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeliveryComplete?: () => void;
  orderDetails?: {
    id: string;
    customer_name: string;
    total: number;
    items: any[];
  };
}

export function OtpVerificationDialog({
  open,
  onOpenChange,
  onDeliveryComplete,
  orderDetails
}: OtpVerificationDialogProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setOtp("");
      setIsVerifying(false);
      setAttemptsLeft(3);
      setVerificationStatus('idle');
      setErrorMessage("");
    }
  }, [open]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && verificationStatus === 'idle') {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a 6-digit OTP code",
        variant: "destructive"
      });
      return;
    }

    if (!orderDetails?.id) {
      toast({
        title: "Error",
        description: "Order information not available",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke('verify-delivery-otp', {
        body: {
          order_id: orderDetails.id,
          otp_code: otp,
          payment_method: 'COD' // Default to COD, can be enhanced to ask user
        }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('✅ OTP verification successful');
        setVerificationStatus('success');
        
        toast({
          title: "✅ Delivery Completed!",
          description: `Order delivered successfully. Payout: ₹${data.payout_amount}`,
        });

        // Wait a moment to show success state, then close and notify parent
        setTimeout(() => {
          onOpenChange(false);
          if (onDeliveryComplete) {
            onDeliveryComplete();
          }
        }, 1500);
      } else {
        throw new Error(data?.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('❌ OTP verification failed:', error);
      setVerificationStatus('error');
      
      const errorMsg = error.message || 'Invalid OTP';
      setErrorMessage(errorMsg);
      
      // Update attempts left if provided in error
      if (error.message?.includes('attempt')) {
        const match = error.message.match(/(\d+) attempt/);
        if (match) {
          setAttemptsLeft(parseInt(match[1]));
        }
      }

      // Reset OTP input for retry
      setOtp("");
      
      toast({
        title: "Verification Failed",
        description: errorMsg,
        variant: "destructive"
      });
      
      // Reset error status after 2 seconds to allow retry
      setTimeout(() => {
        setVerificationStatus('idle');
      }, 2000);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (!isVerifying) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {verificationStatus === 'success' ? '✅ Verified!' : 
             verificationStatus === 'error' ? '❌ Invalid OTP' : 
             'Enter Delivery OTP'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {verificationStatus === 'success' ? 'Delivery completed successfully' :
             verificationStatus === 'error' ? errorMessage :
             'Enter the 6-digit OTP from the customer'}
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary */}
        {orderDetails && verificationStatus === 'idle' && (
          <Card className="bg-muted/50 border-border">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Customer</span>
                </div>
                <span className="font-medium">{orderDetails.customer_name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="w-4 h-4" />
                  <span>Items</span>
                </div>
                <span className="font-medium">{orderDetails.items?.length || 0} items</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IndianRupee className="w-4 h-4" />
                  <span>Amount</span>
                </div>
                <span className="font-semibold">₹{orderDetails.total}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OTP Input */}
        <div className="flex flex-col items-center space-y-6 py-6">
          {verificationStatus === 'idle' && (
            <>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {/* Attempts indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</span>
              </div>
            </>
          )}

          {verificationStatus === 'success' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <p className="text-lg font-semibold text-green-500">Delivery Verified!</p>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {verificationStatus === 'idle' && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || isVerifying}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify OTP'
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isVerifying}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}