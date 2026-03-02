

## Fix blank screen on Android refresh — persistent profile retry

**Root cause**: When `fetchProfile()` times out during `INITIAL_SESSION` (4s limit), `profileState` is set to `'error'`. `RequireApproval` shows a skeleton for `'error'` state but has no mechanism to retry — the user is stuck on a blank/skeleton screen forever. The single 2s retry in the auth store often also fails on slow Android networks.

### Changes

#### 1. `src/store/auth.ts` — More resilient retry with exponential backoff

In the `INITIAL_SESSION` catch block (lines 134-148), replace the single 2s retry with up to 3 retries at increasing intervals (2s, 4s, 8s). This gives Android WebView up to ~18 seconds total to resolve the profile.

```typescript
// Replace single setTimeout retry with:
const retryDelays = [2000, 4000, 8000];
const scheduleRetry = (attempt: number) => {
  if (attempt >= retryDelays.length) return;
  setTimeout(() => {
    if (get().profileState !== 'ready') {
      console.log(`[Auth] Retrying profile fetch (attempt ${attempt + 1})...`);
      get().fetchProfile()
        .catch(() => scheduleRetry(attempt + 1));
    }
  }, retryDelays[attempt]);
};
scheduleRetry(0);
```

Also apply the same retry pattern to the getSession fallback path (lines 187-195).

#### 2. `src/components/auth/RequireApproval.tsx` — Add auto-retry for error state

Instead of showing a static skeleton forever when `profileState === 'error'`, add a `useEffect` that calls `fetchProfile()` every 3 seconds while in error state (max 5 attempts), with a visible "Retry" button as fallback.

```typescript
// Add inside RequireApproval:
const { fetchProfile } = useAuthStore();
const retryCountRef = useRef(0);

useEffect(() => {
  if (profileState !== 'error') {
    retryCountRef.current = 0;
    return;
  }
  if (retryCountRef.current >= 5) return; // give up after 5 tries
  
  const timer = setTimeout(() => {
    retryCountRef.current++;
    fetchProfile().catch(() => {});
  }, 3000);
  return () => clearTimeout(timer);
}, [profileState, fetchProfile]);
```

For the UI: after 5 failed retries, show a "Retry" button instead of infinite skeleton, so the user can tap to try again rather than seeing a blank screen.

#### 3. `src/components/auth/RequireAuth.tsx` — Same retry pattern

Add the same auto-retry `useEffect` for the case where `loading` is false but session exists and profileState is stuck. This prevents the auth layer from being a dead-end.

### Expected result after fix

- Android refresh with slow network: skeleton shows briefly, retries automatically, resolves to `/home` within seconds
- Very slow network: user sees a "Retry" button after ~15s instead of blank screen forever
- Fast network: no change, works as before
