import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Skeleton } from '@/components/ui/skeleton';

export function RequireApproval() {
  const { profile, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

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
