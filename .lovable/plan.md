

## Fix Login-Splash Ping-Pong Loop

**Root cause:** After successful sign-in, Login.tsx redirects to `/splash` when profileState is `error/loading/idle`. Splash then can't resolve the profile either and falls back to `/login` after 5.5s. This creates an infinite redirect cycle, making login appear broken.

### The Fix: Stop bouncing between pages

**Principle:** Login should handle its own post-auth state instead of delegating to Splash. Splash is only for cold app starts.

### Changes

#### 1. `src/pages/Login.tsx` -- Remove splash redirect, handle post-login inline

Remove the problematic redirect to `/splash` (lines 146-156). Instead, after a successful login where profile didn't load in time:
- Navigate directly to the correct destination using explicit navigation in `handleLogin`
- If profile loaded: route based on approval status (already works)
- If profile timed out: navigate to `/my-deliveries` (approved users) or `/upload-documents` (fallback for new users) directly from `handleLogin`, skipping splash entirely

The redirect `useEffect` (lines 121-157) should only handle the case where the user lands on `/login` already authenticated (e.g. browser back button). It should NOT redirect to splash -- instead navigate directly to the correct page or do nothing while profile resolves.

Updated logic:
- `session + profileState === 'ready'` -> route based on approval status (keep as-is)
- `session + profileState === 'missing'` -> route to `/upload-documents` (keep as-is)  
- `session + profileState === 'error/loading/idle'` -> do nothing, let handleLogin's own navigation handle it (remove the splash redirect)

In `handleLogin`, after profile timeout:
```
if (!profileLoaded) {
  // Navigate directly instead of relying on useEffect -> splash
  navigate('/my-deliveries');
}
```

#### 2. `src/pages/Splash.tsx` -- Add error recovery instead of login fallback

When `profileState === 'error'`, splash currently waits forever (until the 5.5s fallback kicks in and sends to login). Instead:
- If session exists AND profileState is `error`, wait for auth store retries (already scheduled with exponential backoff)
- After 8 seconds with session + error state, navigate to `/my-deliveries` instead of `/login` (the route guards will handle auth validation)
- Only fall back to `/login` if there is truly no session

Update the hard fallback (lines 16-20):
- Only navigate to `/login` if `!session` after 5.5s
- If session exists, navigate to `/my-deliveries` instead (RequireAuth + RequireApproval will handle the rest)

Update the routing effect (line 36):
- When `profileState === 'error'` and session exists, set a secondary timeout (e.g. 6s) to navigate to `/my-deliveries` rather than waiting indefinitely

### Result

- Login click -> auth succeeds -> profile loads -> navigate to correct page (fast path, no splash)
- Login click -> auth succeeds -> profile times out -> navigate directly to `/my-deliveries` (no splash bounce)
- Cold app open -> splash -> resolves normally OR falls through to `/my-deliveries` with session (no login bounce)
- No more infinite redirect loop

### Files to edit
- `src/pages/Login.tsx`
- `src/pages/Splash.tsx`

