import { ReactNode } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import Offline from '@/pages/Offline';

export function NetworkStatusWrapper({ children }: { children: ReactNode }) {
  const isOnline = useNetworkStatus();

  if (!isOnline) {
    return <Offline />;
  }

  return <>{children}</>;
}
