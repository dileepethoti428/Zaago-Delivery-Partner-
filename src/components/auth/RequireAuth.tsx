import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useAgentGuard } from '@/hooks/useAgentGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RequireAuth() {
  const { session, loading, profileState, fetchProfile } = useAuthStore();
  const retryCountRef = useRef(0);
  const [exhaustedRetries, setExhaustedRetries] = useState(false);

  // Run agent guard on every protected route
  useAgentGuard();

  // Auto-retry when profileState is stuck in 'error' and we have a session
  useEffect(() => {
    if (profileState !== 'error' || !session) {
      retryCountRef.current = 0;
      setExhaustedRetries(false);
      return;
    }
    if (retryCountRef.current >= 5) {
      setExhaustedRetries(true);
      return;
    }

    const timer = setTimeout(() => {
      retryCountRef.current++;
      fetchProfile().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [profileState, session, fetchProfile]);

  const handleManualRetry = () => {
    retryCountRef.current = 0;
    setExhaustedRetries(false);
    fetchProfile().catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          {exhaustedRetries && (
            <div className="flex flex-col items-center gap-3 pt-4">
              <p className="text-sm text-muted-foreground text-center">
                Unable to connect. Please check your network.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRetry}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
