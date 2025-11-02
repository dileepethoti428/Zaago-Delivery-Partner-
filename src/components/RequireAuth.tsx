import { PropsWithChildren, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Auth guard with approval status check
export default function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // Check session and approval status
    const checkAuthAndApproval = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (error || !session) {
        setIsAuthed(false);
        setIsApproved(false);
        setLoading(false);
        return;
      }

      // User is authenticated
      setIsAuthed(true);

      try {
        // Fetch both user role, profile, and delivery agent status in parallel
        const [roleResult, profileResult, agentResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('approval_status, documents_verified')
            .eq('user_id', session.user.id)
            .single(),
          supabase
            .from('delivery_agents')
            .select('verification_status')
            .eq('agent_id', session.user.id)
            .maybeSingle()
        ]);

        // If user is admin, grant immediate access
        if (roleResult.data?.role === 'admin') {
          setIsApproved(true);
        } else {
          // Check both profiles and delivery_agents for approval status (fallback mechanism)
          const profileApproved = profileResult.data?.approval_status === 'approved';
          const agentApproved = agentResult.data?.verification_status === 'approved';
          
          // Grant access if either table shows approved status
          setIsApproved(profileApproved || agentApproved);
          
          // Log if there's a mismatch for debugging
          if (profileApproved !== agentApproved) {
            console.warn('Approval status mismatch detected:', {
              profileStatus: profileResult.data?.approval_status,
              agentStatus: agentResult.data?.verification_status
            });
          }
        }
      } catch (err) {
        console.error('Error checking approval status:', err);
        setIsApproved(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndApproval();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (!session) {
          setIsAuthed(false);
          setIsApproved(false);
          return;
        }

        setIsAuthed(true);

        try {
          // Fetch both user role, profile, and delivery agent status in parallel
          const [roleResult, profileResult, agentResult] = await Promise.all([
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .eq('role', 'admin')
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('approval_status')
              .eq('user_id', session.user.id)
              .single(),
            supabase
              .from('delivery_agents')
              .select('verification_status')
              .eq('agent_id', session.user.id)
              .maybeSingle()
          ]);

          // If user is admin, grant immediate access
          if (roleResult.data?.role === 'admin') {
            setIsApproved(true);
          } else {
            // Check both profiles and delivery_agents for approval status (fallback mechanism)
            const profileApproved = profileResult.data?.approval_status === 'approved';
            const agentApproved = agentResult.data?.verification_status === 'approved';
            
            // Grant access if either table shows approved status
            setIsApproved(profileApproved || agentApproved);
          }
        } catch (err) {
          console.error('Error checking approval status:', err);
          setIsApproved(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isApproved) return <Navigate to="/pending-approval" replace />;
  
  return children;
}
