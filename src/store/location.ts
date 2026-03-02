import { create } from 'zustand';
import { reverseGeocode, canUseGeolocation, type GeoPoint } from '@/utils/geo';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export type LastKnownLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
};

export type LocationState = {
  permission: PermissionState;
  lastKnown: LastKnownLocation | null;
  label: string | null;
  isWatching: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  startWatch: () => Promise<void>;
  stopWatch: () => void;
  refreshLocation: () => Promise<void>;
  refreshLabel: () => Promise<void>;
  reset: () => void;
};

const STORAGE_KEY = 'zaago_last_loc';

export const useLocationStore = create<LocationState>((set, get) => ({
  permission: 'prompt',
  lastKnown: null,
  label: null,
  isWatching: false,
  error: null,

  init: async () => {
    // Check if geolocation is supported
    if (!canUseGeolocation()) {
      set({ permission: 'unsupported', error: 'Geolocation not supported' });
      return;
    }

    // Hydrate from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          lastKnown: data.location,
          label: data.label || null,
        });
      }
    } catch (error) {
      console.error('Failed to load location from storage:', error);
    }

    // Check permission state
    try {
      // @ts-ignore - geolocation permission query not in all TS versions
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      set({ permission: permissionStatus.state as PermissionState });

      // Listen for permission changes
      permissionStatus.addEventListener('change', () => {
        set({ permission: permissionStatus.state as PermissionState });
      });
    } catch (error) {
      // Permissions API not supported, stay on 'prompt'
      console.warn('Permissions API not supported:', error);
    }
  },

  // Fix 1: GPS watching is owned by useLocationSyncController — only toggle flag here
  startWatch: async () => {
    set({ isWatching: true, error: null });
  },

  stopWatch: () => {
    set({ isWatching: false });
  },

  refreshLocation: async () => {
    if (!canUseGeolocation()) {
      set({ error: 'Geolocation not supported', permission: 'unsupported' });
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LastKnownLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };

          set({
            lastKnown: location,
            permission: 'granted',
            error: null,
          });

          // Persist to localStorage
          try {
            const data = {
              location,
              label: get().label,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch (error) {
            console.error('Failed to save location to storage:', error);
          }

          // Trigger label refresh in background (non-blocking)
          get().refreshLabel();

          resolve();
        },
        (error) => {
          console.error('Location refresh failed:', error);
          set({ error: error.message });
          resolve(); // Resolve anyway so orders can still be fetched
        },
        // Fix 3: Adaptive accuracy — high precision only when app is visible
        { enableHighAccuracy: document.visibilityState === 'visible', timeout: 10000 }
      );
    });
  },

  // Fix 2: Non-blocking reverse geocode — returns immediately, label updates in background
  refreshLabel: async () => {
    const { lastKnown } = get();
    if (!lastKnown) return;

    const point: GeoPoint = {
      lat: lastKnown.lat,
      lng: lastKnown.lng,
    };

    reverseGeocode(point)
      .then((label) => {
        if (!label) return;

        set({ label });

        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ location: get().lastKnown, label })
          );
        } catch {}
      })
      .catch(console.warn);
  },

  reset: () => {
    // Clear location storage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to remove location storage:', e);
    }

    // Reset state
    set({
      permission: 'prompt',
      lastKnown: null,
      label: null,
      isWatching: false,
      error: null,
    });
  },
}));
