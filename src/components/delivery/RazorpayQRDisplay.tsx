import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  const [qrSize, setQrSize] = useState(360);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsQrSize, setFsQrSize] = useState(512);

  useEffect(() => {
    const calc = () => setQrSize(Math.min(560, Math.max(360, Math.floor(window.innerWidth * 0.94))));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  useEffect(() => {
    const calcFs = () => {
      const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.96);
      setFsQrSize(Math.min(860, Math.max(420, size)));
    };
    if (isFullscreen) {
      calcFs();
      window.addEventListener('resize', calcFs);
      return () => window.removeEventListener('resize', calcFs);
    }
  }, [isFullscreen]);

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
    <>
      <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl rounded-2xl p-0 max-h-screen overflow-y-auto">
        {paymentStatus === 'success' ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-green-600 dark:text-green-400">Payment Received!</h3>
              <p className="text-muted-foreground">Completing delivery...</p>
            </div>
          </div>
        ) : (
          <div className="px-5 pt-6 pb-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute right-4 top-4 h-8 w-8 rounded-full opacity-70 hover:opacity-100"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-lg sm:text-xl font-bold tracking-wide text-foreground">BHIM</span>
              <span className="text-lg sm:text-xl font-bold tracking-wide text-foreground">UPI</span>
            </div>

            <div className="flex justify-center">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                {qrData.qr_string ? (
                  <QRCodeSVG
                    value={qrData.qr_string}
                    size={qrSize}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="H"
                    includeMargin
                    style={{ display: 'block', shapeRendering: 'crispEdges', cursor: 'zoom-in' }}
                    onClick={() => setIsFullscreen(true)}
                  />
                ) : (
                  <img
                    src={qrData.image_url}
                    alt="Payment QR Code"
                    style={{ width: qrSize, height: qrSize, imageRendering: 'pixelated', cursor: 'zoom-in' }}
                    onClick={() => setIsFullscreen(true)}
                  />
                )}
              </div>
            </div>

            <div className="mt-4 text-center text-sm font-semibold text-foreground">
              SCAN & PAY WITH ANY UPI APP
            </div>
            <div className="text-center mt-1 text-xs text-muted-foreground">Tap QR to enlarge</div>

            {paymentStatus === 'checking' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking payment...</span>
              </div>
            )}

            {timeLeft === 0 && (
              <div className="mt-4 bg-destructive/10 text-destructive p-3 rounded-lg text-center text-sm">
                QR code expired. Please try again.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={isFullscreen} onOpenChange={(o) => setIsFullscreen(o)}>
      <DialogContent className="rounded-none p-0 w-screen h-screen max-w-none bg-white border-0">
        <div className="w-full h-full flex items-center justify-center bg-white">
          {qrData?.qr_string ? (
            <QRCodeSVG
              value={qrData.qr_string}
              size={fsQrSize}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="H"
              includeMargin
              style={{ display: 'block', shapeRendering: 'crispEdges' }}
            />
          ) : (
            <img
              src={qrData?.image_url}
              alt="Payment QR Code"
              style={{ width: fsQrSize, height: fsQrSize, imageRendering: 'pixelated' }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
