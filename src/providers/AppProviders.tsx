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
import { checkAndRegisterPush } from '@/utils/onesignal';
import { useLocationSyncController } from '@/hooks/useLocationSyncController';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
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
    
    // Initialize dark mode from user settings
    const initDarkMode = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-agent-settings');
        if (data?.settings?.dark_mode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.log('Failed to fetch dark mode preference');
      }
    };
    initDarkMode();
  }, [initAuth, initLocation]);

  // Handle app resume - re-register push if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const user = useAuthStore.getState().user;
        if (user?.email) {
          // Non-blocking push registration check
          checkAndRegisterPush(user.email);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    </PersistQueryClientProvider>
  );
}
