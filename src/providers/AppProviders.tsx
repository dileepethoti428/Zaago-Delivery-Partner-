import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { registerFCMToken } from "@/utils/fcm";
import { setQueryClientRef, setupAppLifecycleListeners, onAppResume } from "@/utils/appLifecycle";
import { App as CapacitorApp } from "@capacitor/app";

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

// Module-level guards — prevent any double-init across React re-renders
let initializedUserId: string | null = null;
let lifecycleInitialized = false;
let capacitorListenerHandle: { remove: () => Promise<void> } | null = null;

/**
 * Initialize the global app lifecycle system once — called after auth is ready.
 * Sets up visibilitychange, focus, pageshow, and Capacitor appStateChange listeners.
 */
async function initGlobalLifecycle() {
  if (lifecycleInitialized) return;
  lifecycleInitialized = true;

  // Web lifecycle listeners (visibilitychange, focus, pageshow)
  setupAppLifecycleListeners();

  // Capacitor-specific resume listener
  try {
    capacitorListenerHandle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
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
    // Not in Capacitor — web fallback handled by setupAppLifecycleListeners
  }
}

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

    // Single global auth state listener for heavy per-login init
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const userId = session?.user?.id ?? null;

      if (!userId) {
        initializedUserId = null;
        return;
      }

      // Skip if already initialized for this user session
      if (userId === initializedUserId) return;
      initializedUserId = userId;

      // Apply theme preference once per login
      try {
        const { data } = await supabase.functions.invoke("get-agent-settings");
        const themePref = data?.settings?.theme_preference;
        if (themePref === "dark") {
          document.documentElement.classList.add("dark");
        } else if (themePref === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.toggle(
            "dark",
            window.matchMedia("(prefers-color-scheme: dark)").matches
          );
        }
      } catch {
        // Keep system preference on error
      }

      // Register FCM once per login
      registerFCMToken();

      // Boot global lifecycle system once auth is confirmed
      initGlobalLifecycle();
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
