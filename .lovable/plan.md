
## Plan: Clean up auth.ts — remove module flags, retries, fallback timer, simplify initialize()

### What changes and why

The current `auth.ts` has accumulated complexity that causes race conditions:
- `listenerRegistered` / `initialized` module flags can get corrupted across hot-reloads or StrictMode
- Retry logic with `scheduleRetry` fires after stale state and conflicts with fresh fetches
- `if (get().profileState !== 'ready')` skips refetch when it shouldn't (e.g. after logout+login)
- 1.5s fallback timer can fire AFTER the listener already resolved, re-triggering a stale fetch
- Profile guard `if (!session) return` prevents fetch in edge cases where session arrives slightly after user

### Exact changes to `src/store/auth.ts`

**1. Remove module flags (lines 8-10)**
Delete `let listenerRegistered = false;` and `let initialized = false;`

**2. Replace `fetchProfile` (lines 52-96)**
Simplify: guard only on `!user`, no session guard, no `throw` (just set error state):
```ts
fetchProfile: async () => {
  const { user } = get();
  if (!user) return;
  set({ profileState: 'loading' });
  try {
    const [profileRes, agentRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('delivery_agents').select('is_active').eq('agent_id', user.id).maybeSingle(),
    ]);
    if (profileRes.data) {
      set({
        profile: { ...(profileRes.data as Profile), isActive: agentRes.data?.is_active ?? true },
        profileState: 'ready',
      });
    } else {
      set({ profile: null, profileState: 'missing' });
    }
  } catch (err) {
    console.warn('[Auth] Profile fetch error:', err);
    set({ profileState: 'error' });
  }
},
```

**3. Replace `initialize` (lines 98-195)**
New clean version: `getSession()` first, then listener, no flags, no fallback timer:
```ts
initialize: async () => {
  set({ loading: true });
  const { data: { session } } = await supabase.auth.getSession();
  set({ session, user: session?.user ?? null, loading: false });
  if (session?.user) {
    set({ profileState: 'loading' });
    get().fetchProfile().catch(() => {});
  }
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] State change:', event);
    set({ session, user: session?.user ?? null, loading: false });
    if (session?.user) {
      set({ profileState: 'loading' });
      get().fetchProfile().catch(() => {});
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        Promise.resolve().then(async () => {
          try {
            await ensureAgentExists();
            registerFCMToken();
            syncLocationAfterAuth();
          } catch (e) {
            console.warn('[AuthInit] Non-blocking init error:', e);
          }
        });
      }
    } else {
      set({ profile: null, profileState: 'idle' });
    }
  });
},
```

**4. Clean `signOut` (lines 197-204)**
Remove `initialized = false` (no flag anymore):
```ts
signOut: async () => {
  await cleanupOnLogout();
  set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
},
```

### Files changed
- `src/store/auth.ts` only — no routing, no layout, no other files
