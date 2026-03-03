import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
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
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success' | 'timeout'>('pending');
  const [timeLeft, setTimeLeft] = useState(300);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const QR_SIZE = 300;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsQrSize, setFsQrSize] = useState(512);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Acquire screen wake lock when QR is open so screen doesn't turn off
  useEffect(() => {
    const acquire = async () => {
      try {
        if (open && 'wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* ignore — not all browsers support this */ }
    };
    acquire();
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const calcFs = () => {
      const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.88);
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

    const interval = setInterval(async () => {
      try {
        setPaymentStatus('checking');
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { qr_id: qrData.qr_id }
        });

        if (error) {
          setPaymentStatus('pending');
          return;
        }

        if (data?.isPaid) {
          setPaymentStatus('success');
          clearInterval(interval);
          setTimeout(() => { onPaymentComplete(); }, 2000);
        } else {
          setPaymentStatus('pending');
        }
      } catch {
        setPaymentStatus('pending');
      }
    }, 3000);

    setPollingInterval(interval);

    const timerInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          clearInterval(interval);
          setPaymentStatus('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
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

  const upiString = qrData.qr_string;

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>

        <DialogContent className="sm:max-w-md rounded-2xl p-0 max-h-screen overflow-y-auto" aria-describedby="payment-qr-desc">
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
            <div className="px-4 pt-5 pb-4">
              <DialogDescription id="payment-qr-desc" className="sr-only">
                Scan the QR code with any UPI app to complete payment
              </DialogDescription>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="absolute right-3 top-3 h-8 w-8 rounded-full opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-base font-bold tracking-wide text-foreground">BHIM UPI</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {paymentStatus === 'checking' ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                    </span>
                  ) : paymentStatus === 'timeout' ? (
                    <span className="text-destructive">Expired</span>
                  ) : (
                    <span className={timeLeft < 60 ? 'text-destructive font-bold' : ''}>
                      ⏱ {formatTime(timeLeft)}
                    </span>
                  )}
                </span>
              </div>

              {/* Amount */}
              <div className="text-center mb-3">
                <span className="text-2xl font-bold text-foreground">₹{orderAmount.toFixed(2)}</span>
                <p className="text-xs text-muted-foreground mt-0.5">Scan to pay this amount</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                {upiString ? (
                  <div
                    className="bg-white rounded-xl border border-border p-3 cursor-zoom-in shadow-sm"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <QRCodeSVG
                      value={upiString}
                      size={QR_SIZE}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="H"
                      includeMargin={false}
                      style={{ display: 'block', shapeRendering: 'crispEdges' }}
                    />
                  </div>
                ) : qrData?.image_url ? (
                  <div
                    className="bg-white rounded-xl border border-border p-3 cursor-zoom-in shadow-sm"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <img
                      src={qrData.image_url}
                      alt="Payment QR Code"
                      style={{
                        width: 360,
                        height: 360,
                        display: 'block',
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                    <p className="text-sm text-center">QR code unavailable.<br/>Please choose another payment method.</p>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground mt-2 mb-1">Tap QR to enlarge</p>
              <p className="text-center text-xs font-semibold text-foreground mt-1">SCAN WITH ANY UPI APP</p>

              {(paymentStatus === 'timeout' || timeLeft === 0) && (
                <div className="mt-3 space-y-2">
                  <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-center text-sm">
                    QR code expired. Please choose another method or retry.
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleClose}>
                    Choose Different Method
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen QR */}
      <Dialog open={isFullscreen} onOpenChange={(o) => setIsFullscreen(o)}>
        <DialogContent className="rounded-none p-0 w-screen h-screen max-w-none border-0 bg-background" aria-describedby="fullscreen-qr-desc">
          <DialogDescription id="fullscreen-qr-desc" className="sr-only">Fullscreen payment QR code</DialogDescription>
          <div className="w-full h-full flex flex-col items-center justify-center bg-background gap-4">
            <p className="text-foreground font-bold text-xl">₹{orderAmount.toFixed(2)}</p>
            {upiString ? (
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={upiString}
                  size={fsQrSize}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                  includeMargin
                  style={{ display: 'block', shapeRendering: 'crispEdges' }}
                />
              </div>
            ) : qrData?.image_url ? (
              <div className="bg-white p-4 rounded-xl">
                <img
                  src={qrData.image_url}
                  alt="Payment QR Code"
                  style={{ width: fsQrSize, height: fsQrSize, display: 'block', imageRendering: 'pixelated' }}
                />
              </div>
            ) : null}
            <p className="text-muted-foreground text-sm">Tap outside to close</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
