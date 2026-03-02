
## Two targeted changes to `src/utils/appLifecycle.ts`

### Fix 1 — Auth guard at the top of `onAppResume` (lines 23–62)
Import `useAuthStore` and add an early-return guard at the top of `onAppResume`. If `authStore.loading` is true (login in progress) OR there is no active session, skip all lifecycle work — including `resetAllLoaders()` and `unlockAllButtons()`. This prevents the lifecycle handler from interfering with in-flight login network requests.

```typescript
import { useAuthStore } from '@/store/auth';

export async function onAppResume() {
  // Guard: skip all lifecycle work if auth is in progress or no session
  const { loading: authLoading, session } = useAuthStore.getState();
  if (authLoading || !session) {
    console.log('[AppLifecycle] Resume ignored — auth in progress or no session');
    return;
  }

  // ... rest of existing function unchanged
}
```

### Fix 2 — 500ms delay on Capacitor `appStateChange` listener (in `AppProviders.tsx`)
Wrap the `onAppResume()` call inside the Capacitor `appStateChange` handler with `setTimeout(..., 500)` to absorb WebView transition noise (keyboard open, permission dialogs, focus events during login).

This change is in `src/providers/AppProviders.tsx`, inside the `setupListener` async function:

```typescript
// Before
if (isActive) {
  onAppResume();
}

// After
if (isActive) {
  setTimeout(() => { onAppResume(); }, 500);
}
```

### Files changed: `src/utils/appLifecycle.ts` and `src/providers/AppProviders.tsx`

**Why this is safe**: The existing `supabase.auth.getSession()` check at line 49 already handles the "no session" case for heavy operations. The new guard at the very top extends this protection to also skip the lightweight-but-destructive `resetAllLoaders()` and `unlockAllButtons()` calls that were running unconditionally even during login. The 500ms delay gives the WebView time to settle after a focus/keyboard event before lifecycle fires.
