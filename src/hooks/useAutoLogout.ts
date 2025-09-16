import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before logout

interface UseAutoLogoutProps {
  enabled: boolean;
}

export const useAutoLogout = ({ enabled }: UseAutoLogoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = () => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    
    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    
    // Hide warning if showing
    if (showWarning) setShowWarning(false);

    // Set warning timer (25 minutes)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: "Session Warning",
        description: "Your session will expire in 5 minutes due to inactivity",
        variant: "destructive"
      });
    }, INACTIVITY_TIME - WARNING_TIME);

    // Set logout timer (30 minutes)
    timerRef.current = setTimeout(async () => {
      try {
        await supabase.auth.signOut();
        toast({
          title: "Session Expired",
          description: "You have been logged out due to inactivity",
          variant: "destructive"
        });
        navigate('/login');
      } catch (error) {
        console.error('Auto logout error:', error);
      }
    }, INACTIVITY_TIME);
  };

  const handleActivity = () => {
    resetTimer();
  };

  useEffect(() => {
    if (!enabled) {
      // Clear timers when disabled
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      setShowWarning(false);
      return;
    }

    // Activity events to monitor
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timer
    resetTimer();

    return () => {
      // Cleanup
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [enabled]);

  const extendSession = () => {
    setShowWarning(false);
    resetTimer();
    toast({
      title: "Session Extended",
      description: "Your session has been extended",
    });
  };

  return {
    showWarning,
    extendSession
  };
};