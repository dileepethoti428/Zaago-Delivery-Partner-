import { useState } from 'react';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { enqueue } from '@/utils/otpQueue';

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  agentId: string;
  onVerified: () => void;   // RPC already marked delivered — refresh caches & navigate
  onSkip: () => void;       // fall through to completeDelivery('ONLINE')
};

const MAX_CLIENT_ATTEMPTS = 5;

export function DeliveryOtpDialog({ open, onClose, orderId, agentId, onVerified, onSkip }: Props) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  const reset = () => {
    setCode('');
    setError(null);
    setAttempts(0);
    setLocked(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSkip = () => {
    if (submitting) return;
    reset();
    onSkip();
  };

  const handleVerify = async () => {
    if (code.length !== 4 || submitting || locked) return;
    setSubmitting(true);
    setError(null);

    // Offline → queue and let partner skip if they want
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueue({ orderId, otp: code, agentId, ts: Date.now() });
      toast({
        title: 'No network',
        description: 'OTP saved — will verify when back online. You can also Skip & Deliver now.',
      });
      setSubmitting(false);
      setCode('');
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_delivery_otp', {
        p_order_id: orderId,
        p_otp: code,
        p_agent_id: agentId,
      });

      if (rpcError) {
        // Treat as network-ish → queue for retry
        if (/network|fetch|failed to fetch/i.test(rpcError.message || '')) {
          enqueue({ orderId, otp: code, agentId, ts: Date.now() });
          toast({ title: 'Network issue', description: 'OTP saved for retry.' });
          setSubmitting(false);
          setCode('');
          return;
        }
        throw new Error(rpcError.message || 'Verification failed');
      }

      const result = data as any;
      if (result?.success) {
        toast({ title: 'Delivery verified ✓', description: 'Order marked delivered.' });
        reset();
        onVerified();
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      const remaining =
        typeof result?.attempts_remaining === 'number'
          ? result.attempts_remaining
          : typeof result?.attempts_left === 'number'
            ? result.attempts_left
            : Math.max(0, MAX_CLIENT_ATTEMPTS - nextAttempts);

      const isLocked = result?.locked === true || result?.attempts_exceeded === true || nextAttempts >= MAX_CLIENT_ATTEMPTS;
      setLocked(isLocked);
      setError(
        isLocked
          ? 'Locked — please use Skip & Deliver.'
          : result?.error || `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      );
      setCode('');
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verify Delivery OTP
          </DialogTitle>
          <DialogDescription>
            Ask the customer for their 4-digit delivery OTP. This step is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <InputOTP
            maxLength={4}
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, ''))}
            disabled={submitting || locked}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <p className="text-sm text-destructive text-center" role="alert">{error}</p>
          )}

          <Button
            className="w-full rounded-xl h-11"
            onClick={handleVerify}
            disabled={code.length !== 4 || submitting || locked}
          >
            {submitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Verifying...</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" />Verify & Deliver</>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full rounded-xl h-11"
            onClick={handleSkip}
            disabled={submitting}
          >
            Skip & Deliver (no OTP)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
