
## Plan: Fix Auth Lifecycle — Pure Event-Driven Initialize

### What's wrong

The current `initialize()` in `src/store/auth.ts` calls `await supabase.auth.getSession()` after registering the listener. Supabase fires `INITIAL_SESSION` automatically when the listener is registered — the explicit `getSession()` call adds a second async trigger that introduces timing variation. On page refresh, the race between `INITIAL_SESSION` (fast, from localStorage) and the `await getSession()` resolution can cause `loading` to flicker or profile fetches to be skipped.

Additionally, `SIGNED_IN` is not treated as an auth-resolved event — so on first login (no existing session), `loading` stays `true` until `INITIAL_SESSION` which may already have fired with `null` session. The `TOKEN_REFRESHED` early-return skips the session sync block below it, which is fine, but the logic for "only update if token changed" runs unconditionally after the early returns for `SIGNED_OUT` and `TOKEN_REFRESHED`, meaning on `SIGNED_IN` it also guards session update behind token diff — which is correct but worth clarifying.

### The fix (minimal, surgical)

**File: `src/store/auth.ts`**

1. **Remove `await supabase.auth.getSession()`** and its try/catch block entirely from `initialize()`. Supabase fires `INITIAL_SESSION` automatically when `onAuthStateChange` is registered — no manual trigger needed.

2. **Add `SIGNED_IN` as a loading-resolver** alongside `INITIAL_SESSION`:
   ```ts
   if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
     set({ loading: false });
   }
   ```
   This handles first login correctly — `INITIAL_SESSION` fires with `null` session (loading → false), then `SIGNED_IN` fires with real session.

3. **Always sync session state unconditionally** (remove the access_token diff guard for non-TOKEN_REFRESHED events) so the session is never stale.

4. Keep `TOKEN_REFRESHED` handling as a silent-update early return.

5. Keep the retry logic for profile fetch — it's correct and defensive.

### Expected boot sequence after fix

```
App Boot
  → onAuthStateChange listener registered
  → INITIAL_SESSION fires (from localStorage, synchronous)
      → session set, loading=false
      → fetchProfile() starts
  → UI renders (auth resolved)
  → Profile ready → queries enabled
```

On first login:
```
INITIAL_SESSION (null) → loading=false
SIGNED_IN → session set, fetchProfile()
```

### No other files need to change.

The `initialized` / `listenerRegistered` module flags are correct and should stay — they prevent duplicate listeners across hot reloads and React re-mounts.
