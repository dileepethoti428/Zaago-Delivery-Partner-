
## Root Causes

1. **`onAuthStateChange` listener set up AFTER awaited calls in `initialize()`** — Supabase requires the listener to be registered BEFORE `getSession()` to reliably catch the `INITIAL_SESSION` event. Current placement misses it on fast network, causing an extra profile fetch cycle.

2. **Listener registered inside `initialize()` with no guard** — every call to `initialize()` (React StrictMode double-mounts) registers a new listener. Duplicate listeners cause double profile fetches and cascading state updates, making login feel slow.

3. **`onAuthStateChange` handler calls `fetchProfile()` on every event** — including `TOKEN_REFRESHED`, which fires on every token refresh (every ~hour and on resume). Each one triggers two DB queries, blocking the UI.

4. **`logoutCleanup` clears `'sb-auth-token'` from localStorage** — this key doesn't match Supabase's actual storage keys. However, the `advancedCache.clear()` wipes the entire in-memory cache including persisted query state, and calling `supabase.auth.signOut()` in cleanup correctly clears the real session. This is fine as-is — not the bug.

5. **The real session persistence bug**: `getSession()` with a 5s timeout returning `null` on slow networks causes the auth store to set `session: null` and `user: null`. When `onAuthStateChange` later fires with the real session, it triggers `fetchProfile()` — but the Splash's `loading === false` has already fired and navigated to `/login`. The user sees login then gets redirected, or stays on login with a valid session.

## Fix Plan

### `src/store/auth.ts`

**Register `onAuthStateChange` listener ONCE, at module level (outside `initialize()`)**:

```typescript
// Module-level listener guard
let listenerRegistered = false;

// Inside create(), register listener once:
initialize: async () => {
  set({ loading: true });

  // Register listener FIRST (required by Supabase docs)
  if (!listenerRegistered) {
    listenerRegistered = true;
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event);
      
      // Only update session state for meaningful events
      if (event === 'SIGNED_OUT') {
        set({ session: null, user: null, profile: null });
        return;
      }
      
      if (event === 'TOKEN_REFRESHED') {
        // Just update the session object silently — no profile fetch needed
        set({ session, user: session?.user ?? null });
        return;
      }
      
      // SIGNED_IN, INITIAL_SESSION, USER_UPDATED
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().fetchProfile();
      } else {
        set({ profile: null });
      }
    });
  }

  try {
    // getSession() is now just a fast local read (session already in memory from listener)
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>(resolve =>
        setTimeout(() => resolve({ data: { session: null } }), 5000)
      ),
    ]);

    const session = (sessionResult as any).data?.session ?? null;
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      await Promise.race([
        get().fetchProfile(),
        new Promise<void>(resolve => setTimeout(resolve, 4000)),
      ]);
    }
  } catch (err) {
    console.warn('[Auth] Initialize error:', err);
    set({ session: null, user: null, profile: null });
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  } finally {
    set({ loading: false });
  }
},
```

Key changes:
- Listener registered **once with a guard** — no duplicate listeners from StrictMode
- `TOKEN_REFRESHED` → only update session object, **no `fetchProfile()` call**
- `SIGNED_OUT` → clear state only, **no `fetchProfile()` call**
- `INITIAL_SESSION` / `SIGNED_IN` → full profile fetch as before

### `src/utils/logoutCleanup.ts`

Remove `'sb-auth-token'` from `STORAGE_KEYS_TO_CLEAR`. Supabase manages its own auth storage keys internally and `signOut()` at the end of cleanup already handles clearing them. Manually removing potentially wrong key names is risky.

Also add a comment making clear this function must ONLY be called from explicit logout paths.

### Summary

| File | Change |
|------|--------|
| `src/store/auth.ts` | Register `onAuthStateChange` once with guard; skip `fetchProfile` on `TOKEN_REFRESHED`; skip state clear on non-logout events |
| `src/utils/logoutCleanup.ts` | Remove `'sb-auth-token'` from manual clear list; add explicit-logout-only warning comment |

No changes to `appLifecycle.ts`, `Login.tsx`, or any other files — the lifecycle already correctly avoids calling `cleanupOnLogout`.
