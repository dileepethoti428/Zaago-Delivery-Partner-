import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { setQueryClientRef } from "@/utils/appLifecycle";
import PostLoginInit from "@/components/PostLoginInit";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

function AuthInitializer({ children }: { children: ReactNode }) {
  const initAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Wire queryClient ref for lifecycle refresh logic
    setQueryClientRef(queryClient);

    // Apply system theme immediately
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", systemDark);

    // Initialize auth (idempotent — module-level guard inside)
    initAuth();
  }, [initAuth]);

  return <>{children}</>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <PostLoginInit />
        {children}
      </AuthInitializer>
      <Toaster />
      <SonnerToaster position="top-center" richColors theme="light" />
    </QueryClientProvider>
  );
}
