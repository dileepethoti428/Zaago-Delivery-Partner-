import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RazorpayQRDisplayProps {
  open: boolean;
  onClose: () => void;
  qrData: any;
  orderAmount: number;
  onPaymentComplete: () => void;
}

export function RazorpayQRDisplay({ 
  open, 
  onClose, 
  qrData, 
  orderAmount,
  onPaymentComplete 
}: RazorpayQRDisplayProps) {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success'>('pending');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open || !qrData?.qr_id) return;

    setPaymentStatus('pending');
    setTimeLeft(300);

    // Start polling for payment status every 3 seconds
    const interval = setInterval(async () => {
      try {
        setPaymentStatus('checking');
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { qr_id: qrData.qr_id }
        });

        if (error) {
          console.error('Error checking payment status:', error);
          setPaymentStatus('pending');
          return;
        }

        if (data?.isPaid) {
          setPaymentStatus('success');
          // Clear interval and trigger completion after a brief success display
          if (interval) clearInterval(interval);
          setTimeout(() => {
            onPaymentComplete();
          }, 2000);
        } else {
          setPaymentStatus('pending');
        }
      } catch (error) {
        console.error('Payment status check failed:', error);
        setPaymentStatus('pending');
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);

    // Countdown timer
    const timerInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          if (pollingInterval) clearInterval(pollingInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (interval) clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, [open, qrData?.qr_id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    onClose();
  };

  if (!qrData) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl rounded-3xl p-0 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-3xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Powered by</span>
              <span className="font-bold text-lg">Razorpay</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full hover:bg-white/20 text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex gap-3 items-center justify-center">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">BHIM UPI</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">UPI</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {paymentStatus === 'success' ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-green-600 dark:text-green-400">Payment Received!</h3>
                <p className="text-muted-foreground">Completing delivery...</p>
              </div>
            </div>
          ) : (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-4 border-gray-200 dark:border-gray-700">
                  <img 
                    src={qrData.image_url} 
                    alt="Payment QR Code"
                    className="w-72 h-72 sm:w-80 sm:h-80"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold">SCAN & PAY WITH ANY UPI APP</p>
                <div className="flex justify-center gap-4 items-center">
                  <div className="text-xs text-muted-foreground">Google Pay</div>
                  <div className="text-xs text-muted-foreground">PhonePe</div>
                  <div className="text-xs text-muted-foreground">Paytm</div>
                  <div className="text-xs text-muted-foreground">BHIM</div>
                </div>
              </div>

              {/* Organization Info */}
              <div className="text-center border-t pt-4">
                <p className="text-xs text-muted-foreground mb-1">Pay to</p>
                <p className="font-bold">ZAAGO PRIVATE ORGANIZATION</p>
              </div>

              {/* Amount */}
              <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                <p className="text-3xl font-bold text-primary">₹{orderAmount}</p>
              </div>

              {/* Timer and Status */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {paymentStatus === 'checking' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground">Checking payment...</span>
                    </>
                  )}
                  {paymentStatus === 'pending' && (
                    <span className="text-muted-foreground">Waiting for payment...</span>
                  )}
                </div>
                <div className="font-mono font-bold">
                  {formatTime(timeLeft)}
                </div>
              </div>

              {timeLeft === 0 && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-center text-sm">
                  QR code expired. Please try again.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
