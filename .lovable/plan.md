
## Current State

Both files are already at a good state from previous fixes:

**`src/store/auth.ts`** — Already has:
- `INITIAL_SESSION || SIGNED_IN` unlocks loading ✅
- `TOKEN_REFRESHED` unlocks loading ✅  
- 1.5s `getSession()` fallback ✅
- `SIGNED_OUT` correctly resets profile ✅

**`src/components/auth/RequireAuth.tsx`** — Already has:
- `if (!loading && !session)` redirect ✅ (line 96)

## What's Still Missing (3 surgical changes)

### 1. `fetchProfile()` — add session guard at the top
Currently line 51-55 guards on `!user`, but NOT on `!session`. If `user` is set but `session` is null (transient state), the Supabase queries will get a 401. Add:
```ts
if (!get().session) {
  console.log('[Profile] No session yet — skipping fetch');
  return;
}
```

### 2. The `else` branch at line 148-150 resets profile during NON-SIGNED_OUT transitions
```ts
} else {
  set({ profile: null, profileState: 'missing' });  // ← BAD: fires on TOKEN_REFRESHED or other events where session briefly is null
}
```
This is inside the handler for all events (after the early returns for TOKEN_REFRESHED and SIGNED_OUT). So if any OTHER event fires with `session = null` (e.g. `USER_UPDATED`), it wipes the profile. Should only happen on SIGNED_OUT (already handled above). Change this to a no-op or add an explicit check.

### 3. The `!user` guard in `fetchProfile()` (line 52-55) also resets profile
```ts
if (!user) {
  set({ profile: null, profileState: 'missing' });
  return;
}
```
This can wipe a valid profile if called during a transient moment where user isn't set yet. Change to just `return` without resetting.

## Exact Changes

**`src/store/auth.ts`**:

**Change A** — lines 51-55: Remove the `set({ profile: null, profileState: 'missing' })` from the `!user` guard:
```ts
fetchProfile: async () => {
  const { user, session } = get();
  if (!session) {
    console.log('[Profile] No session yet — skipping fetch');
    return;
  }
  if (!user) {
    return;  // no reset — just skip silently
  }
```

**Change B** — lines 148-150: Remove the `else` branch that resets profile for non-SIGNED_OUT events:
```ts
// Remove: else { set({ profile: null, profileState: 'missing' }); }
// Replace with nothing — SIGNED_OUT already handles the reset above
```

These are the only 2 changes needed. `RequireAuth.tsx` is already correct at line 96.
