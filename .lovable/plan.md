

## Fix session restoration redirect on refresh

**Root cause**: When `INITIAL_SESSION` fires, the auth store calls `fetchProfile()` non-blocking (line 106) then immediately sets `loading: false` (line 115). The route guards (`RequireApproval`) see `loading=false` + `profile=null` and redirect to `/upload-documents` before the profile has loaded.

**Solution**: Wait for `fetchProfile` to complete before setting `loading: false` in the `INITIAL_SESSION` handler. No new state fields needed — the existing `loading` flag is sufficient if we just await the profile fetch.

### File: `src/store/auth.ts`

Change the INITIAL_SESSION block (lines 96-116) so that:
1. When `INITIAL_SESSION` fires with a session, await `fetchProfile()` (with a 4s timeout to prevent hangs) before setting `loading: false`
2. When `INITIAL_SESSION` fires without a session, set `loading: false` immediately

```text
BEFORE (lines 96-116):
  if (event === 'INITIAL_SESSION') {
    initialSessionReceived = true;
  }
  set({ session, user: session?.user ?? null });
  if (session?.user) {
    if (get().profile?.user_id !== session.user.id) {
      get().fetchProfile().catch(console.warn);  // <-- non-blocking!
    }
  } else {
    set({ profile: null });
  }
  if (event === 'INITIAL_SESSION') {
    set({ loading: false });  // <-- fires before profile is ready
  }

AFTER:
  if (event === 'INITIAL_SESSION') {
    initialSessionReceived = true;
  }
  set({ session, user: session?.user ?? null });
  if (session?.user) {
    if (get().profile?.user_id !== session.user.id) {
      if (event === 'INITIAL_SESSION') {
        // Block loading until profile is ready (with 4s safety timeout)
        await Promise.race([
          get().fetchProfile(),
          new Promise<void>(r => setTimeout(r, 4000)),
        ]).catch(console.warn);
        set({ loading: false });
        return;
      }
      get().fetchProfile().catch(console.warn);
    }
  } else {
    set({ profile: null });
  }
  if (event === 'INITIAL_SESSION') {
    set({ loading: false });
  }
```

This ensures `RequireApproval` only evaluates `profile` after it has been fetched, preventing the false redirect to `/upload-documents` on refresh. Other events (SIGNED_IN, USER_UPDATED) continue to fetch profile non-blocking since `loading` is already false by then.

Only one file changes: `src/store/auth.ts`.
