
## Current State

`AppProviders.tsx` registers a **second** `supabase.auth.onAuthStateChange` listener inside `AuthInitializer` (lines 73–110). This runs in parallel with the one inside `auth.ts`'s `initialize()`, causing:
- Double hydration flows on refresh
- `get-agent-settings` Edge Function called during INITIAL_SESSION (before token is valid → 403)
- FCM registered twice
- Lifecycle initialized twice

The auth store already handles all auth state. AppProviders just needs to:
1. Call `initAuth()` → done ✅
2. Apply theme + init lifecycle **reactively after user is confirmed** (not inside a raw listener)

## Plan

### Step 1 — Remove the second `onAuthStateChange` from `AppProviders.tsx`

Delete lines 72–112 (the entire second listener block including `subscription.unsubscribe`). Keep:
- `setQueryClientRef(queryClient)` 
- System theme application
- `initAuth()` call

### Step 2 — Create `src/components/PostLoginInit.tsx`

A tiny null-rendering component that watches `user` and `loading` from the auth store reactively. Runs side effects only once per user session using a module-level `initializedUserId` guard.

```tsx
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
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);

  useEffect(() => {
    if (loading || !user) {
      if (!user) initializedUserId = null;
      return;
    }
    if (user.id === initializedUserId) return;
    initializedUserId = user.id;

    // Apply theme from settings (non-blocking)
    supabase.functions.invoke("get-agent-settings").then(({ data }) => {
      const pref = data?.settings?.theme_preference;
      if (pref === "dark") document.documentElement.classList.add("dark");
      else if (pref === "light") document.documentElement.classList.remove("dark");
      else document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    }).catch(() => {});

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
      }).then(h => { capacitorListenerHandle = h; }).catch(() => {});
    }
  }, [user, loading]);

  return null;
}
```

### Step 3 — Mount `PostLoginInit` inside `AppProviders`

```tsx
export default function AppProviders({ children }) {
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
```

### Files changed
1. `src/providers/AppProviders.tsx` — remove second listener, dead imports, module-level guards; mount `PostLoginInit`
2. `src/components/PostLoginInit.tsx` — new file with reactive post-login side effects
