import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { getDistanceKm } from '@/utils/geo';

const SYNC_INTERVAL_MS = 15000; // 15 seconds between syncs
const MIN_MOVEMENT_KM = 0.02; // 20 meters - skip sync if agent hasn't moved

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
  const lastSyncedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastPersistRef = useRef<number>(0);

  // Throttled sync to backend
  const syncToBackend = useCallback((coords: GeolocationCoordinates) => {
    const now = Date.now();
    if (now - lastSyncTimeRef.current < SYNC_INTERVAL_MS) return;
    
    if (!session?.access_token) return;

    // Skip if agent hasn't moved more than 20 meters
    const prev = lastSyncedCoordsRef.current;
    if (prev) {
      const dist = getDistanceKm(
        { lat: prev.lat, lng: prev.lng },
        { lat: coords.latitude, lng: coords.longitude }
      );
      if (dist < MIN_MOVEMENT_KM) return;
    }
    
    lastSyncTimeRef.current = now;
    lastSyncedCoordsRef.current = { lat: coords.latitude, lng: coords.longitude };
    console.log('[LocationSync] Syncing:', coords.latitude.toFixed(4), coords.longitude.toFixed(4));

    // Fix 1: Fire-and-forget — never block the GPS callback on network
    supabase.functions.invoke('update-agent-location', {
      body: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading ?? undefined,
        speed: coords.speed ?? undefined,
      },
    }).catch((error) => console.warn('[LocationSync] Sync failed:', error));
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
        if (!isMountedRef.current) return;

        // Update the location store so UI (Home, LocationChip) gets coordinates
        const store = useLocationStore.getState();
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        useLocationStore.setState({
          lastKnown: location,
          permission: 'granted',
          isWatching: true,
          error: null,
        });

        // Fix 3: Throttle localStorage writes to max once per 30 seconds
        const persistNow = Date.now();
        if (persistNow - lastPersistRef.current > 30000) {
          lastPersistRef.current = persistNow;
          try {
            localStorage.setItem('zaago_last_loc', JSON.stringify({
              location,
              label: store.label,
            }));
          } catch {}
        }

        // Trigger debounced label refresh
        store.refreshLabel();

        // Sync to backend (throttled, movement-gated)
        syncToBackend(position.coords);
      },
      (error) => {
        console.warn('[LocationSync] Watch error:', error.message);
      },
      {
        // Fix 2: Smart accuracy — high precision only when app is visible
        enableHighAccuracy: document.visibilityState === 'visible',
        maximumAge: 10000,
        timeout: 15000,
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

  // Start watcher once on mount when session is available.
  // Never stop/restart on visibility or route changes — GPS watcher is already low-power.
  useEffect(() => {
    isMountedRef.current = true;

    if (!session?.access_token) {
      stopSync();
      return;
    }

    // Guard inside startSync (watchIdRef.current !== null) prevents duplicate watchers.
    startSync();

    return () => {
      isMountedRef.current = false;
      // Do NOT call stopSync here — watcher must persist across route changes.
      // It is only stopped when the session ends (access_token becomes null above).
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);
}
