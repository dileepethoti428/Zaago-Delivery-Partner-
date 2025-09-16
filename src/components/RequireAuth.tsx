import { PropsWithChildren, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Simple auth guard: waits for session, then renders children or redirects to /login
export default function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
  const { showWarning, extendSession } = useAutoLogout({ enabled: autoLogoutEnabled });

  useEffect(() => {
    // Subscribe first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setIsAuthed(!!session);
      } else {
        setIsAuthed(!!session);
      }
      
      // Store user email for settings lookup
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
        
        // Fetch auto logout setting when user logs in
        setTimeout(async () => {
          try {
            const { data: agent } = await supabase
              .from('delivery_agents')
              .select('id')
              .eq('email', session.user.email)
              .eq('is_active', true)
              .maybeSingle();

            if (agent) {
              const { data: settings } = await supabase
                .from('agent_settings')
                .select('auto_logout')
                .eq('agent_id', agent.id)
                .maybeSingle();
              
              setAutoLogoutEnabled((settings as any)?.auto_logout ?? true);
            }
          } catch (error) {
            console.error('Error fetching auto logout setting:', error);
          }
        }, 0);
      } else {
        setCurrentUserEmail(null);
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
        if (session?.user?.email) {
          setCurrentUserEmail(session.user.email);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loading]);

  if (loading || isAuthed === null) return null; // or a small spinner placeholder
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  
  return (
    <>
      {children}
      
      {/* Auto Logout Warning Dialog */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="w-[90vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-warning">Session Expiring</DialogTitle>
            <DialogDescription>
              Your session will expire in 5 minutes due to inactivity. Do you want to extend your session?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button 
              variant="outline" 
              onClick={() => supabase.auth.signOut()}
              className="flex-1"
            >
              Logout Now
            </Button>
            <Button 
              onClick={extendSession}
              className="flex-1"
            >
              Extend Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
