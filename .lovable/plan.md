
## Root Cause Analysis

### Bug 1: Infinite login spinner
In `handleLogin` (Login.tsx line 171-214), on **success**, `setLoading(false)` is **never called**. The code calls `fetchProfile()`, then waits for a `useEffect` to navigate. But:
- The `onAuthStateChange` listener in `auth.ts` also fires `SIGNED_IN` and calls `fetchProfile()` again concurrently
- Navigation only happens when `session && profile` are both truthy — if either is delayed, spinner stays forever
- Fix: call `setLoading(false)` explicitly after `fetchProfile()` on the success path

### Bug 2: Session not persisting / user logged out on reopen
In `initialize()`, the `getSession()` races against a **5s timeout that resolves with `session: null`**. On slow networks or WebView cold starts, the timeout wins → `set({ session: null, user: null })` → splash navigates to login. The real session was valid but timed out.

Fix: don't overwrite session state with `null` from the timeout. Only update state if the real `getSession()` returns a value. Let the `onAuthStateChange` `INITIAL_SESSION` event (which fires before `getSession()` resolves) handle setting the session.

### Bug 3: Double fetchProfile race
When login succeeds:
1. `handleLogin` calls `fetchProfile()` directly
2. `onAuthStateChange` fires `SIGNED_IN` → also calls `fetchProfile()`

These run concurrently, causing two simultaneous DB query pairs and making the auth flow unpredictable.

Fix: in the `onAuthStateChange` handler, skip `fetchProfile()` if the store already has a profile for the same user. Or better: in `handleLogin`, don't call `fetchProfile()` manually — let the `SIGNED_IN` event handle it, and navigate from there.

---

## Plan

### `src/store/auth.ts`

1. **`initialize()`**: Change the timeout Promise to never set session to null — use it only as a "give up waiting" signal. After the race, only call `set(...)` if the real getSession returned a session. If timeout wins, let `onAuthStateChange`'s `INITIAL_SESSION` event handle setting session state. Set `loading: false` in finally as before.

2. **`onAuthStateChange` handler**: Add a guard — if event is `SIGNED_IN` and `get().profile?.user_id === session.user.id`, skip `fetchProfile()` (already fetched by Login directly). This prevents the double-fetch race.

3. **Keep everything else the same** — listener guard, TOKEN_REFRESHED behavior, SIGNED_OUT behavior.

### `src/pages/Login.tsx`

**`handleLogin` success path**: After `fetchProfile()`, call `setLoading(false)`. The `useEffect` watching `session + profile` will then navigate. This fixes the infinite spinner.

Also remove the redundant second `onAuthStateChange` subscription in Login (lines 134-144) that listens for `PASSWORD_RECOVERY` — keep it, it's needed for password reset. Leave it unchanged.

---

## Summary

| File | Change |
|------|--------|
| `src/store/auth.ts` | Don't overwrite session with null on timeout; skip fetchProfile in SIGNED_IN if profile already loaded for same user |
| `src/pages/Login.tsx` | Call `setLoading(false)` on login success path after fetchProfile |

### What stays unchanged
- Listener guard (`listenerRegistered`)
- `TOKEN_REFRESHED` → silent session update
- `SIGNED_OUT` → clear state
- `logoutCleanup` — not touched
- `AppLifecycle` — not touched
- All navigation logic in Login `useEffect`
