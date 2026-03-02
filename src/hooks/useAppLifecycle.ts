import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useAuthStore } from '@/store/auth';
import { registerFCMToken } from '@/utils/fcm';
import { setupAppLifecycleListeners, onAppResume } from '@/utils/appLifecycle';

let lifecycleReady = false;

/**
 * Screen-level lifecycle hook.
 * Sets up app resume listeners once (idempotent).
 * Call from main active screens (Home, MyDeliveries).
 */
export function useAppLifecycle() {
  useEffect(() => {
    // Setup global listeners once (idempotent via internal guard)
    if (!lifecycleReady) {
      const { loading } = useAuthStore.getState();
      if (!loading) {
        setupAppLifecycleListeners();
        lifecycleReady = true;
      }
    }

    // Capacitor-specific resume listener
    let listener: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      try {
        listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            const { loading } = useAuthStore.getState();
            if (!loading) {
              setTimeout(() => onAppResume(), 500);
            }
            const user = useAuthStore.getState().user;
            if (user) registerFCMToken();
          }
        });
      } catch {
        // Not in Capacitor — use visibility fallback
        const handleVisibility = () => {
          if (document.visibilityState === "visible") {
            const user = useAuthStore.getState().user;
            if (user) registerFCMToken();
          }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
      }
    };

    setup();

    return () => {
      if (listener) listener.remove();
    };
  }, []);
}
