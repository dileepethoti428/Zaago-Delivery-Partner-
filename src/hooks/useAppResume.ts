import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

/**
 * Hook to handle app resume from background/idle state.
 * - If idle > 2 minutes: full page reload (Zepto-style stability)
 * - If idle < 2 minutes: just invalidate queries
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const lastActiveTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const idleTime = Date.now() - lastActiveTimeRef.current;
        
        if (idleTime > STALE_THRESHOLD) {
          console.log('[AppResume] App was idle for', Math.round(idleTime / 1000), 's - reloading');
          window.location.reload();
        } else {
          console.log('[AppResume] App resumed after', Math.round(idleTime / 1000), 's - invalidating queries');
          queryClient.invalidateQueries();
        }
      } else {
        // App going to background - record time
        lastActiveTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);
}
