import { ReactNode, useEffect, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import Offline from '@/pages/Offline';
import { flush } from '@/utils/otpQueue';
import { toast } from '@/hooks/use-toast';

export function NetworkStatusWrapper({ children }: { children: ReactNode }) {
  const isOnline = useNetworkStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      flush()
        .then(({ verified }) => {
          if (verified > 0) {
            toast({ title: 'Pending OTP verified', description: `${verified} delivery verified.` });
          }
        })
        .catch(() => {
          /* silent */
        });
    }
  }, [isOnline]);

  if (!isOnline) {
    return <Offline />;
  }

  return <>{children}</>;
}
