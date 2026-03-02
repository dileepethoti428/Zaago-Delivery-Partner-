import { useEffect, type ReactNode } from 'react';
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/location";
import { advancedCache } from '@/utils/advancedCache';
import { agentSession } from '@/utils/agentSession';
import { supabase } from '@/integrations/supabase/client';
import { registerFCMToken } from '@/utils/fcm';
import { App } from '@capacitor/app';
import { useLocationSyncController } from '@/hooks/useLocationSyncController';
import { setupAppLifecycleListeners, setQueryClientRef, onAppResume } from '@/utils/appLifecycle';
import { GlobalLoader } from '@/components/layout/GlobalLoader';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Filter out orders queries from persistence - they get stale quickly and cause delivered orders to reappear
const shouldDehydrateQuery = (query: { queryKey: readonly unknown[] }) => {
  const key = query.queryKey[0];
  // DON'T persist orders - they get stale quickly and show delivered orders
  if (key === 'orders' || key === 'available-orders' || key === 'assigned-orders') {
    return false;
  }
  return true;
};

// Async-safe storage adapter wrapping advancedCache — defers reads/writes off the main thread
const asyncStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    const agentId = agentSession.getCurrentAgentId();
    const fullKey = agentId ? `${key}_${agentId}` : key;
    return Promise.resolve(advancedCache.get<string>(fullKey));
  },
  setItem: (key: string, value: string): Promise<void> => {
    const agentId = agentSession.getCurrentAgentId();
    const fullKey = agentId ? `${key}_${agentId}` : key;
    advancedCache.set(fullKey, value, 10 * 60 * 1000);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    const agentId = agentSession.getCurrentAgentId();
    const fullKey = agentId ? `${key}_${agentId}` : key;
    advancedCache.delete(fullKey);
    return Promise.resolve();
  },
};

const persister = createAsyncStoragePersister({
  storage: asyncStorageAdapter,
});

// Module-level guard: run heavy init work only once per user login
let initializedUserId: string | null = null;

function AuthInitializer({ children }: { children: ReactNode }) {
  const initAuth = useAuthStore((state) => state.initialize);
  const initLocation = useLocationStore((state) => state.init);

  // Clean location sync: starts on visible, stops on background
  useLocationSyncController();

  useEffect(() => {
    // Initialize authentication
    initAuth();
    
    // Initialize location services
    initLocation();
    
    // Initialize global app lifecycle listeners (reset stuck states on resume)
    setQueryClientRef(queryClient);
    setupAppLifecycleListeners();
    
    // Apply system theme immediately while waiting for session
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', systemDark);

    // Listen for auth state changes — heavy init runs ONCE per user login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const userId = session?.user?.id ?? null;

      // Reset guard on sign-out so next login re-initializes
      if (!userId) {
        initializedUserId = null;
        return;
      }

      // Skip if we already ran heavy init for this user (token refresh, resume, etc.)
      if (userId === initializedUserId) return;

      initializedUserId = userId;

      // Fetch theme preference only once per login
      try {
        const { data } = await supabase.functions.invoke('get-agent-settings');
        const themePref = data?.settings?.theme_preference;
        if (themePref === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (themePref === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
      } catch {
        // Keep system preference on error
      }

      // Register FCM only once per login
      registerFCMToken();
    });

    return () => subscription.unsubscribe();
  }, [initAuth, initLocation]);

  // Handle app resume (Capacitor) - SAFE: only removes THIS listener
  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    
    const setupListener = async () => {
      try {
        listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            // Delay to absorb WebView transition noise (keyboard, permission dialogs)
            setTimeout(() => { onAppResume(); }, 500);
            
            const user = useAuthStore.getState().user;
            if (user) {
              registerFCMToken();
            }
          }
        });
      } catch (e) {
        // Not in Capacitor environment - use visibility fallback
        const handleVisibility = () => {
          if (document.visibilityState === 'visible') {
            const user = useAuthStore.getState().user;
            if (user) {
              registerFCMToken();
            }
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
    
    setupListener();
    
    // SAFE: Only remove THIS specific listener, not all listeners
    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  return <>{children}</>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery,
        },
      }}
    >
      <AuthInitializer>
        {children}
      </AuthInitializer>
      <Toaster />
      <SonnerToaster 
        position="top-center"
        richColors
        theme="light"
      />
      <GlobalLoader />
    </PersistQueryClientProvider>
  );
}
