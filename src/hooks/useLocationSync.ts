import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth';

const SYNC_DEBOUNCE_MS = 5000; // Minimum 5 seconds between syncs

export function useLocationSync() {
  const { session } = useAuthStore();
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  // CRITICAL: This function is completely NON-BLOCKING
  // Any failure is logged as a warning but never throws or affects app flow
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
      // Check if geolocation is available
      if (!navigator.geolocation) {
        console.warn('[LocationSync] Geolocation not supported - skipping sync');
        return;
      }

      // Get current position with error handling
      let position: GeolocationPosition;
      try {
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          });
        });
      } catch (geoError) {
        // User denied permission, timeout, or position unavailable - all OK
        console.warn('[LocationSync] Geolocation unavailable (non-blocking):', geoError);
        return;
      }

      const { latitude, longitude, accuracy, heading, speed } = position.coords;

      // Validate coordinates before sending
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        isNaN(latitude) ||
        isNaN(longitude)
      ) {
        console.warn('[LocationSync] Invalid coordinates (non-blocking):', { latitude, longitude });
        return;
      }

      console.log('[LocationSync] Syncing location:', { latitude, longitude });

      // Send to edge function with full error handling
      try {
        const { data, error } = await supabase.functions.invoke('update-agent-location', {
          body: {
            latitude,
            longitude,
            accuracy,
            heading: heading ?? undefined,
            speed: speed ?? undefined,
          },
        });

        if (error) {
          // Edge function returned error - log warning and continue
          console.warn('[LocationSync] Edge function error (non-blocking):', error);
        } else if (data?.success === false) {
          // Edge function returned success:false - log reason and continue
          console.warn('[LocationSync] Sync returned non-success (non-blocking):', data?.reason || 'unknown');
        } else {
          console.log('[LocationSync] Location synced successfully');
          lastSyncRef.current = Date.now();
        }
      } catch (invokeError) {
        // Network error or edge function crash - log and continue
        console.warn('[LocationSync] Invoke failed (non-blocking):', invokeError);
      }
    } catch (unexpectedError) {
      // Catch-all for any unexpected errors - never throw
      console.warn('[LocationSync] Unexpected error (non-blocking):', unexpectedError);
    } finally {
      isSyncingRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    // Delay initial sync by 2s to allow GPS to warm up
    const initialSyncTimeout = setTimeout(() => {
      syncLocation();
    }, 2000);

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
      clearTimeout(initialSyncTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncLocation]);

  return { syncLocation };
}
