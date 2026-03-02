import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { registerFCMToken } from "@/utils/fcm";
import { setQueryClientRef } from "@/utils/appLifecycle";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Module-level guard: run heavy init work only once per user login
let initializedUserId: string | null = null;

function AuthInitializer({ children }: { children: ReactNode }) {
  const initAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize authentication
    initAuth();

    // Set queryClient ref for lifecycle handler
    setQueryClientRef(queryClient);

    // Apply system theme immediately while waiting for session
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", systemDark);

    // Listen for auth state changes — heavy init runs ONCE per user login
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
        const { data } = await supabase.functions.invoke("get-agent-settings");
        const themePref = data?.settings?.theme_preference;
        if (themePref === "dark") {
          document.documentElement.classList.add("dark");
        } else if (themePref === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
      } catch {
        // Keep system preference on error
      }

      // Register FCM only once per login
      registerFCMToken();
    });

    return () => subscription.unsubscribe();
  }, [initAuth]);

  return <>{children}</>;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>{children}</AuthInitializer>
      <Toaster />
      <SonnerToaster position="top-center" richColors theme="light" />
    </QueryClientProvider>
  );
}
