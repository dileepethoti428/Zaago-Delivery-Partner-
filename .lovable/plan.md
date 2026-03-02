
## Root Cause Analysis

The auth store has a fundamental architectural flaw: **`initialize()` is called every time Splash mounts**, but `listenerRegistered` is a module-level flag that persists across hot reloads. On native WebView (Capacitor), the module IS re-evaluated on cold start but the listener guard can get out of sync.

More critically, the real session logout problem: **`initialize()` calls `set({ loading: true })` then awaits getSession. If getSession resolves BEFORE `onAuthStateChange` fires `INITIAL_SESSION`, the flow is:**

1. `getSession()` returns valid session → `set({ session, user })`
2. `fetchProfile()` starts with 4s timeout race
3. `loading: false` set in `finally`
4. Splash navigates to `/home` ✅

But on slow networks or after OS kills the WebView:
1. `getSession()` races 5s timeout → **timeout wins** → `timedOut = true`, no state set
2. `onAuthStateChange` INITIAL_SESSION fires but `loading` is already `false`
3. Splash already navigated to `/login` ❌

**The core bugs:**

### Bug 1: Splash delay is 1500ms when no cache
`const delay = hasCache ? 200 : 1500;` — even when `loading` is already `false`, the splash waits 1.5 seconds. Remove this artificial delay.

### Bug 2: Session persists but profile fetch fails silently
When `getSession()` times out but `onAuthStateChange` sets the session afterward, the `loading` is already `false` and Splash has already exited. Need to wait for INITIAL_SESSION before setting `loading: false`.

### Bug 3: `initialize()` called on EVERY Splash mount
AppProviders also calls `initAuth()` (via `useAuthStore.initialize`) in `AuthInitializer`. So `initialize()` is called TWICE — once from AppProviders and once from Splash.

### Bug 4: `onAuthStateChange` in AppProviders (AppProviders.tsx lines 66-88) fires SEPARATELY
`AppProviders` has its OWN `onAuthStateChange` subscription for theme + FCM. This is SEPARATE from the auth store listener. These are fine but the theme/FCM one fires on INITIAL_SESSION and calls `registerFCMToken()` — no issue.

## The Real Fix

### Strategy: Let `onAuthStateChange` drive the flow entirely

The correct Supabase pattern is:
1. Register `onAuthStateChange` listener
2. Call `getSession()` as a fast cache read (it's synchronous from localStorage)
3. `INITIAL_SESSION` event fires synchronously with the session from localStorage
4. Set `loading: false` only AFTER `INITIAL_SESSION` has fired

**Key insight**: `supabase.auth.getSession()` reads from localStorage synchronously if no token refresh is needed. It only goes to the network if the access token is expired and needs refreshing. So on most app opens, it resolves instantly.

The 5s timeout race is protecting against network hangs during token refresh. But when the timeout wins, we don't know if `onAuthStateChange` has already fired or not.

**Solution**: Use a single flag to track whether `INITIAL_SESSION` has already been received by the listener. If yes, skip the `getSession()` set. If `getSession()` times out AND `INITIAL_SESSION` hasn't fired yet, THEN we know auth is truly blocked — set loading false and go to login.

### Changes

#### `src/store/auth.ts`

Replace the timeout race logic with a cleaner flow:
- Add `initialSessionReceived` flag
- In `onAuthStateChange`, if event is `INITIAL_SESSION`, set flag + set `loading: false` after profile fetch
- In `initialize()`, after the Promise.race, if `timedOut && !initialSessionReceived` → auth is stuck, clear state and set `loading: false`
- If `timedOut && initialSessionReceived` → listener handled it, don't overwrite

Also: the `initialize()` function should be **idempotent** — add an `initialized` flag so calling it twice has no effect.

```typescript
let listenerRegistered = false;
let initialized = false;
let initialSessionReceived = false;

initialize: async () => {
  if (initialized) return; // idempotent — skip if already ran
  initialized = true;
  set({ loading: true });

  // Register listener FIRST
  if (!listenerRegistered) {
    listenerRegistered = true;
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ session: null, user: null, profile: null });
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        set({ session, user: session?.user ?? null });
        return;
      }
      // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
      if (event === 'INITIAL_SESSION') {
        initialSessionReceived = true;
      }
      set({ session, user: session?.user ?? null });
      if (session?.user && get().profile?.user_id !== session.user.id) {
        await get().fetchProfile();
      } else if (!session) {
        set({ profile: null });
      }
      // For INITIAL_SESSION: set loading false after profile is loaded
      if (event === 'INITIAL_SESSION') {
        set({ loading: false });
      }
    });
  }

  try {
    // Race getSession vs 5s timeout
    const result = await Promise.race([
      supabase.auth.getSession().then(r => ({ timedOut: false as const, session: r.data.session })),
      new Promise<{ timedOut: true; session: null }>(resolve =>
        setTimeout(() => resolve({ timedOut: true, session: null }), 5000)
      ),
    ]);

    if (!result.timedOut) {
      // getSession returned — if INITIAL_SESSION hasn't fired yet, handle session here
      if (!initialSessionReceived) {
        const session = result.session;
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          await Promise.race([
            get().fetchProfile(),
            new Promise<void>(r => setTimeout(r, 4000)),
          ]);
        }
        set({ loading: false });
      }
      // else: INITIAL_SESSION already handled everything, loading already set
    } else {
      // Timeout — if INITIAL_SESSION never came, give up and go to login
      if (!initialSessionReceived) {
        console.warn('[Auth] getSession timed out and no INITIAL_SESSION — clearing session');
        set({ session: null, user: null, profile: null, loading: false });
      }
      // else: INITIAL_SESSION came and handled it
    }
  } catch (err) {
    console.warn('[Auth] Initialize error:', err);
    set({ session: null, user: null, profile: null });
    try { await supabase.auth.signOut(); } catch {}
    set({ loading: false });
  }
}
```

Also: on `signOut()`, reset `initialized` and `initialSessionReceived` flags so next login cycle works correctly.

#### `src/pages/Splash.tsx`

Remove the `1500ms` delay — change to `0ms` (immediate navigate when `loading === false`). Keep the 6s hard fallback but reduce to 5s to match the auth timeout.

```typescript
// Remove hasCache delay — navigate immediately when loading is done
const delay = hasCache ? 0 : 0; // always 0
```

Also fix navigation: add `deactivated` status check (currently missing from Splash, present in Login).

#### `src/providers/AppProviders.tsx`

Remove the SECOND `initAuth()` call — it's already called from Splash. The AuthInitializer should NOT call `initialize()` since Splash does. Instead, only set up the theme/FCM listener without calling `initialize()` again. This prevents the double initialization.

Wait — actually, looking again: `AppProviders` calls `initAuth()` which is `useAuthStore.initialize`. And Splash also calls `initialize()`. With the `initialized` idempotency guard, the second call is a no-op. So this is fine to leave as-is once the guard is added. But we should keep the AppProviders call because if the user navigates directly to a non-splash route, Splash may not mount.

### Summary

| File | Change |
|------|--------|
| `src/store/auth.ts` | Add idempotency guard; track `initialSessionReceived`; set `loading: false` in `INITIAL_SESSION` handler; fix timeout fallback to only clear if `INITIAL_SESSION` never arrived; reset flags on signOut |
| `src/pages/Splash.tsx` | Remove 1500ms artificial delay; add `deactivated` status check; reduce hard fallback to 5s |
