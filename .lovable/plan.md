
## Root Cause: 401 on `unified-complete-delivery` — Token Not Being Sent Correctly

The analytics logs confirm the function IS being called (not a CORS issue), but returns **401 Unauthorized**:
```
POST | 401 | unified-complete-delivery (1280ms)
```

The code in `completeDelivery` does this sequence:
1. `refreshSession()` — this is failing silently ("Failed to fetch" in network logs)
2. `getSession()` — returns the locally-cached session
3. Passes `session.access_token` in the `Authorization` header

The problem: the `unified-complete-delivery` edge function uses `supabase.auth.getUser(token)` with the **service role client**, but the edge function code does:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
```
This validates the token against Supabase Auth. If the token is expired (which it is — refresh is failing), this returns null/error → 401.

### The Real Fix: Skip `refreshSession()` entirely before `completeDelivery`

The `refreshSession()` call before `completeDelivery` can itself cause problems — if it fails or the session is stale, the subsequent `getSession()` may return an expired token. Instead:
1. **Use `getSession()` directly** (no pre-refresh)  
2. **If token is missing/expired, show a clear "Session expired, please log in again" message** instead of silently failing
3. **Add a fallback**: if 401 is returned from the edge function, show "Session expired — please log out and log back in" rather than a generic error

Additionally, the `supabase.functions.invoke` already sends the auth token automatically from the client's current session — the manual `Authorization` header override may be causing a conflict. We should **remove the manual header** and let the SDK handle auth automatically.

## Changes

### `src/pages/ManageDelivery.tsx`
- In `completeDelivery`: Remove the manual `Authorization` header — let `supabase.functions.invoke` send auth automatically
- Remove the pre-action `refreshSession()` call — it's causing more harm than good when network is spotty
- Add explicit 401 error message: "Session expired. Please log out and log in again."
- Same cleanup for `handleQRPaymentComplete`

This is a small, targeted fix. The SDK auto-attaches the session token to `functions.invoke` calls — no need to manually pass it, and manually overriding it with a potentially stale token is what's causing the 401.
