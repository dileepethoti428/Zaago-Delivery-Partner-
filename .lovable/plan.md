
## Root Cause Analysis

The problem is a race condition / hang in `auth.initialize()`:

1. `supabase.auth.getSession()` internally tries to **refresh the token** if the stored refresh token is expired or invalid. This network call can hang, throw, or take >5s.
2. `initialize()` has **no timeout** — it awaits `getSession()` indefinitely. If the call hangs, `loading` stays `true` forever.
3. `fetchProfile()` also has **no timeout** — if the DB call hangs (network issue), `loading` also stays `true` forever.
4. `Splash.tsx` waits for `loading === false` before navigating. So if `initialize()` never finishes, the splash never exits.

---

## Plan: Fix Splash Screen Stuck on Auth Initialization

### Changes

#### `src/store/auth.ts` — Add timeout + error safety to `initialize()`

```
initialize: async () => {
  set({ loading: true });

  try {
    // Race getSession against a 5s timeout
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 5000))
    ]);

    const session = sessionResult.data?.session ?? null;
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      // Race fetchProfile against a 4s timeout  
      await Promise.race([
        get().fetchProfile(),
        new Promise(resolve => setTimeout(resolve, 4000))
      ]);
    }
  } catch (err) {
    // Invalid refresh token or network error — clear state and proceed to login
    console.warn('[Auth] Initialize error, clearing session:', err);
    set({ session: null, user: null, profile: null });
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  } finally {
    // Always mark loading as done
    set({ loading: false });
  }

  // Set up listener AFTER session is resolved (not before)
  supabase.auth.onAuthStateChange(async (event, session) => {
    // ... keep existing listener logic
  });
},
```

Key points:
- `getSession()` races against **5s timeout** — if it hangs, `session = null` and flow proceeds to login
- `fetchProfile()` races against **4s timeout** — if DB is slow, app still transitions
- `try/catch` around entire block catches invalid refresh token errors (`AuthApiError`, network failures)
- On any error: clear session state + silent `signOut()` to clear bad tokens from storage
- `finally` block **always** sets `loading: false` — splash will always exit

#### `src/pages/Splash.tsx` — Add hard fallback timeout

Add a second safety net directly in the splash: a **6s hard timeout** that forces navigation regardless of auth store state. This is the last line of defense if something upstream still blocks.

```typescript
// Hard fallback: if still stuck after 6s, go to login
useEffect(() => {
  const fallback = setTimeout(() => {
    navigate('/login');
  }, 6000);
  return () => clearTimeout(fallback);
}, []); // only runs once on mount
```

This fallback:
- Only fires if the normal `loading → navigate` flow hasn't already run
- Is safe because `navigate('/login')` from splash is idempotent if already on login

---

### Summary

| File | Change |
|------|--------|
| `src/store/auth.ts` | Wrap `initialize()` in try/catch/finally; race `getSession()` vs 5s timeout; race `fetchProfile()` vs 4s timeout; always `set({ loading: false })` in `finally` |
| `src/pages/Splash.tsx` | Add 6s hard fallback `setTimeout` that redirects to `/login` unconditionally |

### What stays unchanged
- Navigation logic in Splash (session → home/pending/rejected routing)
- `onAuthStateChange` listener behavior
- `fetchProfile()` function itself
- Business logic, UI, all other files
