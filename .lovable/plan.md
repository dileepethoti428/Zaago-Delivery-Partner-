
## Two targeted changes to `src/store/auth.ts`

### Fix 1 — Parallel DB queries in fetchProfile (lines 54–75)
Replace the sequential `profiles` → `delivery_agents` queries with `Promise.all([...])`. Both queries fire simultaneously, cutting 1 round-trip from the login/resume path.

**Lines 54–75 replacement:**
```typescript
const [profileRes, agentRes] = await Promise.all([
  supabase.from('profiles').select('*').eq('user_id', user.id).single(),
  supabase.from('delivery_agents').select('is_active').eq('agent_id', user.id).maybeSingle(),
]);

if (!profileRes.error && profileRes.data) {
  set({
    profile: {
      ...(profileRes.data as Profile),
      isActive: agentRes.data?.is_active ?? true,
    }
  });
} else {
  set({ profile: null });
}
```

### Fix 2 — Non-blocking profile fetch in auth listener (line 113)
Change `await get().fetchProfile()` → `get().fetchProfile().catch(console.warn)`.

**Why it's safe**: the `loading: false` on line 122 is set after the profile call anyway for `INITIAL_SESSION`. For `SIGNED_IN`/`USER_UPDATED`, the Splash screen already watches `profile` reactively — it will navigate once profile resolves. Removing `await` here means the auth event handler returns instantly, unblocking all other queued Supabase auth listeners and lifecycle handlers.

**Note on the `getSession` fallback path (line 148)**: This path already has its own `Promise.race` with a 4s timeout and is not in the hot path (only fires if `INITIAL_SESSION` never arrives). We leave it as `await` — it's intentionally blocking there since it directly controls `loading: false`.

### Only file changed: `src/store/auth.ts`
