import { PropsWithChildren, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Simple auth guard: waits for session, then renders children or redirects to /login
export default function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Subscribe first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setIsAuthed(!!session);
      } else {
        setIsAuthed(!!session);
      }
      
      // Always set loading to false once we get a session update
      if (loading) {
        setLoading(false);
      }
    });

    // Then fetch existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Session error:', error);
        setIsAuthed(false);
      } else {
        setIsAuthed(!!session);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loading]);

  if (loading || isAuthed === null) return null; // or a small spinner placeholder
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
