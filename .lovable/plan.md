
## Analysis

### Fix 1 — Heavy work on every auth state change (AppProviders.tsx lines 84-104)
The `onAuthStateChange` listener fires on INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, app resume, network reconnect — and each time calls `get-agent-settings` edge function + `registerFCMToken()`. This is the exact cause of the "delivered button stuck / loader freeze on map return".

**Fix**: Add a `let initializedUserId: string | null = null` module-level guard outside the `useEffect`. In the listener, skip all heavy work if `userId === initializedUserId`. Reset to `null` on `SIGNED_OUT`. Also filter out `TOKEN_REFRESHED` event explicitly.

Note: `registerFCMToken()` already has its own `fcmInitialized` guard in `fcm.ts` — but the edge function call has no guard, so it fires every token refresh. The userId guard fixes both.

### Fix 2 — Sync storage persister blocks UI thread (AppProviders.tsx lines 41-59)
`createSyncStoragePersister` reads/writes JSON on the main thread during React Query hydration. On resume, this blocks renders.

**Fix**: Switch to `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister`. The `advancedCache` adapter already has async-compatible methods (it uses try/catch internally). The async persister defers the read/write off the critical render path.

However — `advancedCache.get()` and `advancedCache.set()` are **synchronous** (they call `localStorage` directly). The async persister needs Promises. We need to wrap them. The cleanest approach: keep the existing `advancedCache` but wrap the storage adapter methods in `Promise.resolve()`.

### Fix 3 — Location sync runs unconditionally (AppProviders.tsx line 66)
`useLocationSyncController()` is called at the top of `AuthInitializer` regardless of auth state. On startup before login, it starts watching GPS immediately (wasted work + conflicts with maps).

**Fix**: The hook already checks `session?.access_token` internally and stops sync when not logged in — so it's actually safe. BUT calling the hook unconditionally means the hook mounts and subscribes to the auth store from the very first render. The real issue is that calling hooks conditionally is illegal in React. The correct fix is to keep the unconditional hook call but ensure the hook only does work when `session` is present — which it already does. The hook is already auth-gated.

Actually re-reading the hook: line 127 checks `if (!session?.access_token) { stopSync(); return; }` — so it already does nothing when not logged in. The user's suggested fix (`if (user) { useLocationSyncController(); }`) is invalid React (conditional hook call). We leave this hook call as-is since it's correctly guarded internally.

## Plan

### Changes to `src/providers/AppProviders.tsx`

**Fix 1**: Add `let initializedUserId: string | null = null;` at module level (outside component). In the `onAuthStateChange` callback:
- Get `userId = session?.user?.id`
- If `!userId` → set `initializedUserId = null` and return (handles sign-out reset)
- If `userId === initializedUserId` → return early (skip all heavy work)
- Set `initializedUserId = userId`, then proceed with settings fetch + FCM

**Fix 2**: Replace `createSyncStoragePersister` with `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister`. Wrap storage adapter methods to return Promises.

**Fix 3**: Leave `useLocationSyncController()` call unchanged — it's already internally auth-gated. No change needed.

### Package change
Add `@tanstack/query-async-storage-persister` as a dependency.

### Summary table

| File | Change |
|------|--------|
| `src/providers/AppProviders.tsx` | Add userId guard to auth listener; switch to async storage persister |
| `package.json` | Add `@tanstack/query-async-storage-persister` |
