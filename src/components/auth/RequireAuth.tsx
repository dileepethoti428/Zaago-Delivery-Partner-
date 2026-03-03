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
  const [bypassLoading, setBypassLoading] = useState(false);

  // Run agent guard on every protected route
  useAgentGuard();

  // 8s escape timeout — never block authenticated users indefinitely
  // Uses a ref to track if timer was started, so profileState transitions don't reset it
  const timerStarted = useRef(false);
  useEffect(() => {
    if (!loading) {
      setBypassLoading(false);
      timerStarted.current = false;
      return;
    }
    if (timerStarted.current) return;
    timerStarted.current = true;
    const timer = setTimeout(() => setBypassLoading(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

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

  if (loading && !bypassLoading) {
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

  // If bypass is active and we have a session, let through even if loading
  if (bypassLoading && session) {
    return <Outlet />;
  }

  // Bypass active but no session — go to login
  if (bypassLoading && !session) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && !session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
