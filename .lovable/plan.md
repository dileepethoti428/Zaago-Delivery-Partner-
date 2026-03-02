

## Add Idempotent Session Updates to Auth Store

**Problem:** Supabase emits multiple auth events (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) that often carry the same session. Each `set()` call creates a new object reference, causing downstream subscribers like `useLocationSyncController` (which depends on `session?.access_token`) to re-run their effects -- stopping and restarting GPS watchers unnecessarily.

**Fix:** Compare `access_token` before calling `set()`, skipping the update when the session hasn't actually changed. Two locations need this guard.

### File: `src/store/auth.ts`

**Change 1 -- TOKEN_REFRESHED handler (lines 104-108)**

Only update if the access token actually changed:

```typescript
if (event === 'TOKEN_REFRESHED') {
  const current = get().session;
  if (current?.access_token !== session?.access_token) {
    set({ session, user: session?.user ?? null });
  }
  return;
}
```

**Change 2 -- General session set (line 115)**

Replace the unconditional `set()` with a guarded version:

```typescript
const currentSession = get().session;
if (currentSession?.access_token !== session?.access_token) {
  set({ session, user: session?.user ?? null });
}
```

This applies to INITIAL_SESSION, SIGNED_IN, and USER_UPDATED events. The rest of the handler (profile fetch, loading flag) remains unchanged since it already has its own guards (`profile?.user_id !== session.user.id`).

**Result:** LocationSync (and any other subscriber keyed on `session`) will only re-run when the token genuinely changes. No more duplicate "Started/Stopped/Started" cycles in logs.

