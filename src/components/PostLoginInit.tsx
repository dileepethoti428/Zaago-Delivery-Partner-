import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { registerFCMToken } from "@/utils/fcm";
import { setupAppLifecycleListeners, onAppResume } from "@/utils/appLifecycle";
import { App as CapacitorApp } from "@capacitor/app";

let initializedUserId: string | null = null;
let lifecycleInitialized = false;
let capacitorListenerHandle: { remove: () => Promise<void> } | null = null;

export default function PostLoginInit() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading || !user) {
      if (!user) initializedUserId = null;
      return;
    }
    if (user.id === initializedUserId) return;
    initializedUserId = user.id;

    // Apply theme from settings (non-blocking)
    supabase.functions
      .invoke("get-agent-settings")
      .then(({ data }) => {
        const pref = data?.settings?.theme_preference;
        if (pref === "dark") document.documentElement.classList.add("dark");
        else if (pref === "light") document.documentElement.classList.remove("dark");
        else
          document.documentElement.classList.toggle(
            "dark",
            window.matchMedia("(prefers-color-scheme: dark)").matches
          );
      })
      .catch(() => {});

    // Register FCM
    registerFCMToken();

    // Init lifecycle once
    if (!lifecycleInitialized) {
      lifecycleInitialized = true;
      setupAppLifecycleListeners();
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          const { loading } = useAuthStore.getState();
          if (!loading) setTimeout(() => onAppResume(), 500);
          if (useAuthStore.getState().user) registerFCMToken();
        }
      })
        .then((h) => {
          capacitorListenerHandle = h;
        })
        .catch(() => {});
    }
  }, [user, loading]);

  return null;
}
