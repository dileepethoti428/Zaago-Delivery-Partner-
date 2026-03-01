import { useEffect, type ReactNode } from 'react';
import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
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

const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => {
      const agentId = agentSession.getCurrentAgentId();
      const fullKey = agentId ? `${key}_${agentId}` : key;
      return advancedCache.get(fullKey);
    },
    setItem: (key, value) => {
      const agentId = agentSession.getCurrentAgentId();
      const fullKey = agentId ? `${key}_${agentId}` : key;
      advancedCache.set(fullKey, value, 10 * 60 * 1000);
    },
    removeItem: (key) => {
      const agentId = agentSession.getCurrentAgentId();
      const fullKey = agentId ? `${key}_${agentId}` : key;
      advancedCache.delete(fullKey);
    },
  },
});

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
    
    // Initialize theme from user settings (system default with override)
    const initTheme = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-agent-settings');
        const themePref = data?.settings?.theme_preference; // 'system' | 'light' | 'dark'
        
        if (themePref === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (themePref === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // Default: follow system preference
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (systemDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (error) {
        // Fallback to system preference
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemDark);
      }
    };
    initTheme();
  }, [initAuth, initLocation]);

  // Handle app open - register FCM if user is logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        registerFCMToken();
      }
    });
  }, []);

  // Handle app resume (Capacitor) - SAFE: only removes THIS listener
  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    
    const setupListener = async () => {
      try {
        listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            // Run app resume handler to reset stuck states
            onAppResume();
            
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
