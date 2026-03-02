import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RequireApproval() {
  const { profile, profileState, loading, fetchProfile } = useAuthStore();
  const retryCountRef = useRef(0);
  const [exhaustedRetries, setExhaustedRetries] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);

  // 8s escape timeout — never block authenticated users indefinitely
  useEffect(() => {
    if (profileState === 'ready' || profileState === 'missing') {
      setBypassLoading(false);
      return;
    }
    const timer = setTimeout(() => setBypassLoading(true), 8000);
    return () => clearTimeout(timer);
  }, [profileState]);

  // Auto-retry when profileState is 'error'
  useEffect(() => {
    if (profileState !== 'error') {
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
  }, [profileState, fetchProfile]);

  const handleManualRetry = () => {
    retryCountRef.current = 0;
    setExhaustedRetries(false);
    fetchProfile().catch(() => {});
  };

  // Auth session still loading
  if (loading && !bypassLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Profile is still resolving — wait, but bypass after 8s
  if (profileState === 'idle' || profileState === 'loading' || profileState === 'error') {
    if (bypassLoading) {
      return <Outlet />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          {exhaustedRetries && (
            <div className="flex flex-col items-center gap-3 pt-4">
              <p className="text-sm text-muted-foreground text-center">
                Unable to load your profile. Please check your connection.
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

  // profileState is 'ready' or 'missing' — safe to make routing decisions

  // No profile or documents not submitted
  if (!profile || !profile.documents_submitted) {
    return <Navigate to="/upload-documents" replace />;
  }

  // Check approval status
  if (profile.approval_status === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (profile.approval_status === 'rejected') {
    return <Navigate to="/rejected" replace />;
  }

  if (profile.approval_status === 'deactivated' || profile.isActive === false) {
    return <Navigate to="/deactivated" replace />;
  }

  // Approved - render protected routes
  return <Outlet />;
}
