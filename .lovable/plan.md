
## Analysis

The user's diagnosis is partially correct but the actual fix needed is nuanced.

**What the current code does:**
- `onAuthStateChange` is registered, then Supabase fires `INITIAL_SESSION` synchronously from localStorage on listener registration
- `TOKEN_REFRESHED` now also sets `loading: false` (from prior fix)
- 4s safety fallback exists

**The user's claim:** "INITIAL_SESSION doesn't always fire" — this is true in very specific edge cases (Capacitor, StrictMode double-mount timing, storage access delay on some mobile WebViews).

**The actual gap still present:** The 4s safety timeout sets `loading: false` BUT does NOT set `session`. So if the safety timeout triggers, `session` remains `null` → `RequireAuth` redirects to `/login` → user must log in again. This is the "blank screen then redirect to login" symptom.

**The correct fix:** Add a `getSession()` call as a safety net — not as the primary mechanism, but as the fallback when no auth event has fired within a short window. This ensures `session` is populated even if `INITIAL_SESSION` was missed.

### Plan

**One file change: `src/store/auth.ts`**

1. After registering the `onAuthStateChange` listener, add a short-window `getSession()` fallback (after 1.5s) that only fires if `loading` is still `true` — this covers the "INITIAL_SESSION missed" edge case without creating race conditions with the normal flow
2. The listener remains the primary mechanism (no change to event handling)
3. Remove the old 4s timeout that unlocks loading but leaves session null — replace it with the getSession fallback that properly sets both

**Specific change:**

Replace the safety timeout (lines 157-163) with:

```ts
// Fallback: if INITIAL_SESSION hasn't fired within 1.5s, manually restore session
// This covers Capacitor/WebView environments where the event can be missed
setTimeout(async () => {
  if (!get().loading) return; // already resolved by event
  console.warn('[Auth] INITIAL_SESSION not received — falling back to getSession()');
  try {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });
    if (data.session?.user && get().profileState !== 'ready') {
      get().fetchProfile().catch(() => {});
    }
  } catch {
    set({ loading: false });
  }
}, 1500);
```

**Why 1.5s not 4s:** `INITIAL_SESSION` fires synchronously/near-instantly. If it hasn't fired in 1.5s, it's genuinely missed and we need the fallback. 4s is too long — causes visible blank screen.

**Why not replace the listener with getSession entirely (as user suggests):** The `onAuthStateChange` listener is critical for handling `SIGNED_OUT`, `TOKEN_REFRESHED`, and future session changes. Removing it would break real-time auth state management.

**Also fix `RequireAuth.tsx`:** The user correctly identified that the redirect logic should be `!loading && !session`. Currently line 76: `if (!session)` — this can fire during the brief window while loading is true but session hasn't been set yet. Change to `if (!loading && !session)`.
