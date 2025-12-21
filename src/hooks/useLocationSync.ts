import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth';

const SYNC_DEBOUNCE_MS = 5000; // Minimum 5 seconds between syncs

export function useLocationSync() {
  const { session } = useAuthStore();
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  const syncLocation = useCallback(async () => {
    // Don't sync if not authenticated
    if (!session?.access_token) {
      return;
    }

    // Debounce to prevent rapid syncs
    const now = Date.now();
    if (now - lastSyncRef.current < SYNC_DEBOUNCE_MS) {
      return;
    }

    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      // Get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });

      const { latitude, longitude, accuracy, heading, speed } = position.coords;

      console.log('[LocationSync] Syncing location:', { latitude, longitude });

      // Send to edge function
      const { error } = await supabase.functions.invoke('update-agent-location', {
        body: {
          latitude,
          longitude,
          accuracy,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
        },
      });

      if (error) {
        console.error('[LocationSync] Error syncing location:', error);
      } else {
        console.log('[LocationSync] Location synced successfully');
        lastSyncRef.current = Date.now();
      }
    } catch (error) {
      // Silently handle geolocation errors (user may have denied permission)
      if (error instanceof GeolocationPositionError) {
        console.warn('[LocationSync] Geolocation error:', error.message);
      } else {
        console.error('[LocationSync] Error:', error);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    // Sync on mount (app open)
    syncLocation();

    // Sync when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[LocationSync] App came to foreground, syncing location');
        syncLocation();
      }
    };

    // Sync on focus (user clicks back into app)
    const handleFocus = () => {
      console.log('[LocationSync] Window focused, syncing location');
      syncLocation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncLocation]);

  return { syncLocation };
}
