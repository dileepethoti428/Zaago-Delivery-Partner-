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
    let debounceTimer: NodeJS.Timeout | null = null;

    // Cache auth check in sessionStorage to prevent duplicate checks
    const cacheKey = 'auth_check_cache';
    const cacheDuration = 30000; // 30 seconds

    // Check session and approval status
    const checkAuthAndApproval = async () => {
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { isAuthed: cachedAuth, isApproved: cachedApproval, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheDuration) {
            console.log('Using cached auth status');
            setIsAuthed(cachedAuth);
            setIsApproved(cachedApproval);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Invalid cache, continue with normal check
        }
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (error || !session) {
        setIsAuthed(false);
        setIsApproved(false);
        setLoading(false);
        sessionStorage.setItem(cacheKey, JSON.stringify({
          isAuthed: false,
          isApproved: false,
          timestamp: Date.now()
        }));
        return;
      }

      // User is authenticated
      setIsAuthed(true);

      try {
        // Fetch approval status in parallel
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

        const isAdmin = roleResult.data?.role === 'admin';
        const profileApproved = profileResult.data?.approval_status === 'approved';
        const agentApproved = agentResult.data?.verification_status === 'approved';
        const approved = isAdmin || profileApproved || agentApproved;
        
        if (!mounted) return;
        
        setIsApproved(approved);
        
        // Cache the result
        sessionStorage.setItem(cacheKey, JSON.stringify({
          isAuthed: true,
          isApproved: approved,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Error checking approval status:', err);
        if (mounted) setIsApproved(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAuthAndApproval();

    // Subscribe to auth changes with debouncing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // Clear cache on auth change
        sessionStorage.removeItem(cacheKey);
        
        // Debounce rapid auth state changes
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
          if (!mounted) return;
          
          if (!session) {
            setIsAuthed(false);
            setIsApproved(false);
            return;
          }

          // Re-check approval status
          checkAuthAndApproval();
        }, 200); // 200ms debounce
      }
    );

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
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
