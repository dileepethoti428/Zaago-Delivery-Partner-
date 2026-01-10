import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth';

const SYNC_INTERVAL_MS = 15000; // 15 seconds between syncs

/**
 * Unified location sync controller that:
 * - Starts watching when app is visible AND user is logged in
 * - Stops watching when app goes to background OR user logs out
 * - Throttles backend updates to 15 seconds
 * - No background sync, no battery drain
 */
export function useLocationSyncController() {
  const { session } = useAuthStore();
  const watchIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Throttled sync to backend
  const syncToBackend = useCallback(async (coords: GeolocationCoordinates) => {
    const now = Date.now();
    if (now - lastSyncTimeRef.current < SYNC_INTERVAL_MS) return;
    
    if (!session?.access_token) return;
    
    lastSyncTimeRef.current = now;
    console.log('[LocationSync] Syncing:', coords.latitude.toFixed(4), coords.longitude.toFixed(4));

    try {
      await supabase.functions.invoke('update-agent-location', {
        body: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading ?? undefined,
          speed: coords.speed ?? undefined,
        },
      });
    } catch (error) {
      console.warn('[LocationSync] Sync failed (non-blocking):', error);
    }
  }, [session?.access_token]);

  // Start watching location
  const startSync = useCallback(() => {
    if (watchIdRef.current !== null) return; // Already running
    if (!navigator.geolocation) {
      console.warn('[LocationSync] Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (isMountedRef.current) {
          syncToBackend(position.coords);
        }
      },
      (error) => {
        console.warn('[LocationSync] Watch error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
    console.log('[LocationSync] Started');
  }, [syncToBackend]);

  // Stop watching location
  const stopSync = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('[LocationSync] Stopped');
    }
  }, []);

  // Handle visibility changes and auth state
  useEffect(() => {
    isMountedRef.current = true;

    // Don't start if not logged in
    if (!session?.access_token) {
      stopSync();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startSync();
      } else {
        stopSync();
      }
    };

    // Start immediately if visible and logged in
    if (document.visibilityState === 'visible') {
      startSync();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopSync();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.access_token, startSync, stopSync]);
}
