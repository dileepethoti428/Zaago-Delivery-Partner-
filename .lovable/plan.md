

# Fix: "Delivered" Button Hangs After Returning from Google Maps

## Root Cause

The app already has resume detection (`onAppResume`, `useResumeGuard`, Capacitor `appStateChange`), and it already resets loading states. The actual problem is:

1. **Stale Supabase session token**: `refreshSession()` in `appLifecycle.ts` calls `supabase.auth.getSession()` which only reads the cached session from memory -- it does NOT refresh the JWT token. After the WebView is backgrounded for a while, the token can expire or the connection can go stale, causing the `unified-complete-delivery` edge function call to hang.

2. **Supabase Realtime channel disconnection**: When the WebView goes to background, the Supabase realtime WebSocket connection drops. On resume, the client doesn't immediately reconnect, so any realtime-dependent features stall.

3. **Race condition**: `onAppResume()` is async (refreshes session), but the user can click "Delivered" before the session refresh completes, hitting the edge function with a stale token.

## Fix Plan

### 1. Use `refreshSession()` instead of `getSession()` in app lifecycle

**File**: `src/utils/appLifecycle.ts`

Change the `refreshSession` function to actually refresh the JWT token:

```typescript
export async function refreshSession() {
  try {
    // Actually refresh the token, not just read cached session
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.warn('[AppLifecycle] Session refresh error:', error);
      // Fallback: try getSession to see if we still have a valid one
      const { data: fallback } = await supabase.auth.getSession();
      if (!fallback.session) {
        console.log('[AppLifecycle] No active session');
      }
      return;
    }
    
    console.log('[AppLifecycle] Session refreshed successfully');
  } catch (e) {
    console.warn('[AppLifecycle] Session refresh failed:', e);
  }
}
```

### 2. Add order-details query invalidation on resume

**File**: `src/utils/appLifecycle.ts`

Add `order-details` to the list of invalidated queries in `refreshQueries()` so ManageDelivery gets fresh data:

```typescript
queryClientRef.invalidateQueries({ queryKey: ['order-details'] });
queryClientRef.invalidateQueries({ queryKey: ['earnings'] });
```

### 3. Pre-refresh session before edge function calls in ManageDelivery

**File**: `src/pages/ManageDelivery.tsx`

In `completeDelivery()`, before calling `getSession()`, add a proactive token refresh to ensure the token is fresh:

```typescript
// Ensure token is fresh (especially after returning from Maps)
await supabase.auth.refreshSession();
const { data: { session } } = await supabase.auth.getSession();
```

Apply the same fix to `generateAndShowQR()` and `handleQRPaymentComplete()`.

### 4. Add timeout to edge function calls

**File**: `src/pages/ManageDelivery.tsx`

Wrap the `supabase.functions.invoke` calls with an AbortController timeout so they fail fast instead of hanging forever:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const { data, error } = await supabase.functions.invoke('unified-complete-delivery', {
    body: { ... },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  // ... handle response
} finally {
  clearTimeout(timeout);
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/appLifecycle.ts` | Use `supabase.auth.refreshSession()` instead of `getSession()`; add more query keys to invalidation |
| `src/pages/ManageDelivery.tsx` | Pre-refresh session before edge function calls; add request timeout |

## Result

- Returning from Google Maps triggers `onAppResume` which now actually refreshes the JWT token
- Clicking "Delivered" will have a fresh token ready, so the edge function call succeeds immediately
- If the token refresh hasn't completed yet, the inline `refreshSession()` call in `completeDelivery()` ensures it happens before the request
- 15-second timeout prevents infinite loading -- fails fast with a clear error instead of hanging

