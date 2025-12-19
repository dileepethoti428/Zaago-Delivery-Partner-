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
const UPDATE_THROTTLE_MS = 30000; // 30 seconds
const LABEL_DEBOUNCE_MS = 20000; // 20 seconds

let watchId: number | null = null;
let lastUpdateTime = 0;
let labelTimeoutId: NodeJS.Timeout | null = null;

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

  startWatch: async () => {
    if (!canUseGeolocation()) {
      set({ error: 'Geolocation not supported', permission: 'unsupported' });
      return;
    }

    if (get().isWatching) return;

    set({ isWatching: true, error: null });

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    };

    const onSuccess = (position: GeolocationPosition) => {
      const now = Date.now();
      
      // Throttle updates
      if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
        return;
      }
      lastUpdateTime = now;

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

      // Refresh label (debounced)
      if (labelTimeoutId) {
        clearTimeout(labelTimeoutId);
      }
      labelTimeoutId = setTimeout(() => {
        get().refreshLabel();
      }, LABEL_DEBOUNCE_MS);
    };

    const onError = (error: GeolocationPositionError) => {
      let errorMsg = 'Location error';
      let permission: PermissionState = get().permission;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = 'Location permission denied';
          permission = 'denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = 'Location unavailable';
          break;
        case error.TIMEOUT:
          errorMsg = 'Location request timeout';
          break;
      }

      set({ error: errorMsg, permission });
    };

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
  },

  stopWatch: () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    
    if (labelTimeoutId) {
      clearTimeout(labelTimeoutId);
      labelTimeoutId = null;
    }

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

          // Trigger label refresh in background
          get().refreshLabel();
          
          resolve();
        },
        (error) => {
          console.error('Location refresh failed:', error);
          set({ error: error.message });
          resolve(); // Resolve anyway so orders can still be fetched
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  },

  refreshLabel: async () => {
    const { lastKnown } = get();
    if (!lastKnown) return;

    const point: GeoPoint = {
      lat: lastKnown.lat,
      lng: lastKnown.lng,
    };

    const label = await reverseGeocode(point);
    
    if (label) {
      set({ label });
      
      // Update storage with new label
      try {
        const data = {
          location: lastKnown,
          label,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to update label in storage:', error);
      }
    }
  },

  reset: () => {
    // Stop any active watch
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    
    if (labelTimeoutId) {
      clearTimeout(labelTimeoutId);
      labelTimeoutId = null;
    }
    
    // Reset module-level variables
    lastUpdateTime = 0;
    
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
