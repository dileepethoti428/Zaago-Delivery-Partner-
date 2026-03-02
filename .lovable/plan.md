
## What the code actually shows

Looking at line 122:
```ts
if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
  set({ loading: false });
}
```

`SIGNED_IN` is **already** handled as a loading resolver. The user's diagnosis that "only INITIAL_SESSION unlocks loading" is incorrect — the code already handles both.

**The real remaining issue** is line 154–155:
```ts
// No manual getSession() call — Supabase fires INITIAL_SESSION automatically
```

When the app boots with an existing session in localStorage, Supabase fires `INITIAL_SESSION` immediately and synchronously when `onAuthStateChange` is registered — this should work. But there is a subtle edge case: if Supabase cannot read from localStorage quickly (e.g., storage access timing on mobile/Capacitor), neither `INITIAL_SESSION` nor `SIGNED_IN` fires, and `loading` stays `true` forever.

**The actual remaining gap:** There is no safety timeout. If for any reason neither `INITIAL_SESSION` nor `SIGNED_IN` fires within a reasonable window, the UI is frozen indefinitely. The user's suggestion of a 3s safety fallback `setTimeout` is the correct defensive fix.

**Additionally**, the user mentioned `TOKEN_REFRESHED` can sometimes be the FIRST event on cold boot (before `INITIAL_SESSION`). The current code handles `TOKEN_REFRESHED` with an early return that sets session+user but **does not set `loading: false`**. So if `TOKEN_REFRESHED` fires first and then no other event fires, `loading` stays `true`.

## The Fix (minimal, 2 changes to `src/store/auth.ts`)

### Change 1 — `TOKEN_REFRESHED`: also unlock loading
```ts
if (event === 'TOKEN_REFRESHED') {
  set({ session, user: session?.user ?? null, loading: false });
  return;
}
```

### Change 2 — Safety timeout after listener registration
Add after the `if (!listenerRegistered)` block closes:
```ts
// Safety fallback — if no auth event fires within 4s, unlock UI
setTimeout(() => {
  if (get().loading) {
    console.warn('[Auth] Safety unlock triggered — no auth event received');
    set({ loading: false });
  }
}, 4000);
```

These two changes together cover all edge cases:
- `INITIAL_SESSION` fires → ✅ already handled
- `SIGNED_IN` fires → ✅ already handled  
- `TOKEN_REFRESHED` fires first (cold boot) → ✅ now handled
- No event fires at all (storage failure, Capacitor quirk) → ✅ safety timeout

**Only file: `src/store/auth.ts`**. No other files need changes.
