import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a delivery_agents row exists for the current authenticated user.
 * Non-blocking — failures are logged but never thrown to callers.
 */
export async function ensureAgentExists(): Promise<void> {
  try {
    console.log('[PostAuthInit] Ensuring agent exists in delivery_agents...');
    const { data, error } = await supabase.functions.invoke('ensure-agent-exists');
    if (error) {
      console.error('[PostAuthInit] Error ensuring agent exists:', error);
    } else {
      console.log('[PostAuthInit] Agent ensured:', data);
    }
  } catch (error) {
    console.error('[PostAuthInit] Failed to ensure agent exists:', error);
  }
}

/**
 * Best-effort one-shot location sync after auth.
 * Completely non-blocking — failures never affect navigation.
 */
export async function syncLocationAfterAuth(): Promise<void> {
  try {
    if (!navigator.geolocation) {
      console.warn('[PostAuthInit] Geolocation not supported — skipping location sync');
      return;
    }

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
      console.warn('[PostAuthInit] Geolocation unavailable — skipping location sync:', geoError);
      return;
    }

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    console.log('[PostAuthInit] Syncing location:', { latitude, longitude });

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
        console.warn('[PostAuthInit] Location sync edge function error (non-blocking):', error);
      } else if (data?.success === false) {
        console.warn('[PostAuthInit] Location sync non-success (non-blocking):', data?.reason ?? 'unknown');
      } else {
        console.log('[PostAuthInit] Location synced successfully');
      }
    } catch (invokeError) {
      console.warn('[PostAuthInit] Location sync invoke failed (non-blocking):', invokeError);
    }
  } catch (unexpectedError) {
    console.warn('[PostAuthInit] Unexpected location sync error (non-blocking):', unexpectedError);
  }
}
