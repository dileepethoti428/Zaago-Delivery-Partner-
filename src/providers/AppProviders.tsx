import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/location";
import { advancedCache } from '@/utils/advancedCache';
import { agentSession } from '@/utils/agentSession';

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

  useEffect(() => {
    // Initialize authentication
    initAuth();
    
    // Initialize location services
    initLocation();
  }, [initAuth, initLocation]);

  return <>{children}</>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
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
