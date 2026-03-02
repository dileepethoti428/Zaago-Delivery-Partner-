

## Fix: Stop blocking users on blank skeleton screen

**Root cause**: `RequireApproval` completely blocks the app UI when `profileState` is `error/loading/idle`, showing only skeleton loaders. On slow Android networks, profile fetch keeps timing out, retries keep failing, and the user is stuck on a blank screen indefinitely -- even though they are already authenticated.

**Principle**: A returning authenticated user should never be blocked from using the app. The profile check is important but should not be a hard gate that traps users.

### Changes

#### 1. `src/components/auth/RequireApproval.tsx` -- Add escape timeout

When profileState is stuck in `error/loading/idle` for more than 8 seconds, stop blocking and render the app (`<Outlet />`). The profile will resolve via background retries and the route guards will redirect if needed.

- Add a `useEffect` with an 8-second timer that sets a `bypassLoading` flag
- When `bypassLoading` is true AND profileState is still unresolved, render `<Outlet />` instead of skeleton
- If profile resolves to a non-approved state during this time, the normal redirect logic kicks in
- Reset the bypass flag when profileState becomes `ready` or `missing` (no longer needed)

This ensures: worst case, user waits 8 seconds then sees the app. Profile loads in background, and if they're not approved, the redirect happens then.

#### 2. `src/components/auth/RequireAuth.tsx` -- Same escape timeout

Add the same 8-second bypass for the `loading` state skeleton. If auth loading is stuck beyond 8 seconds but a session exists in the store, render `<Outlet />` instead of skeleton.

#### 3. `src/store/auth.ts` -- Increase profile fetch timeout to 6s

The current 4-second timeout for `fetchProfile` during `INITIAL_SESSION` is too aggressive for Android WebView on slow networks. Increase to 6 seconds to give it a better chance of succeeding on the first try, reducing the need for retries.

### Technical details

```text
Current flow (broken):
  Login -> /my-deliveries -> RequireAuth -> RequireApproval
                                              |
                                    profileState = error
                                              |
                                    skeleton forever (retries fail)

Fixed flow:
  Login -> /my-deliveries -> RequireAuth -> RequireApproval
                                              |
                                    profileState = error
                                              |
                                    skeleton for max 8s
                                              |
                                    bypass -> render app
                                              |
                                    background retry succeeds -> profile ready
```

### Files to edit
- `src/components/auth/RequireApproval.tsx` -- add 8s escape timeout
- `src/components/auth/RequireAuth.tsx` -- add 8s escape timeout  
- `src/store/auth.ts` -- increase profile timeout from 4s to 6s

