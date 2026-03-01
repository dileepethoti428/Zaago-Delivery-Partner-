

# Fix: "Delivered" Button Hangs and App Runs Slowly

## Root Causes Found

### 1. The 15-second timeout is a no-op
The `AbortController` was added in the last fix, but `supabase.functions.invoke()` does NOT accept a `signal` option. The controller is created and cleared, but **never actually connected to the fetch request**. So when the edge function hangs, it hangs forever.

**Fix**: Use `Promise.race` to implement an actual timeout:
```typescript
const result = await Promise.race([
  supabase.functions.invoke('unified-complete-delivery', { ... }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
]);
```

### 2. Network storm on every resume causes slowness
When the app resumes from background, **all of these fire simultaneously**:
- `visibilitychange` listener calls `onAppResume()` -- refreshes session + invalidates queries
- `window.focus` listener calls `onAppResume()` -- same thing again (500ms debounce may not catch both)
- Capacitor `appStateChange` calls `onAppResume()` -- third time
- React Query's `refetchOnWindowFocus: true` (global default) -- refetches ALL active queries automatically

This means every single query in the app (orders, earnings, delivery history, order details, settings) refetches **twice** on every resume -- once from React Query's built-in mechanism and once from the manual `invalidateQueries` in `onAppResume()`. This network storm makes the app feel slow.

**Fix**: Set `refetchOnWindowFocus: false` globally in QueryClient defaults. The manual `refreshQueries()` in `onAppResume()` already handles this. Increase debounce from 500ms to 2000ms.

### 3. Pre-action `refreshSession()` can itself hang
In `completeDelivery()`, `await supabase.auth.refreshSession()` is called before the edge function. If the network is slow after returning from Maps, this call can hang too, making the button appear unresponsive before the actual delivery request even starts.

**Fix**: Wrap the session refresh in a 4-second timeout so it fails fast.

## Changes

### File: `src/providers/AppProviders.tsx`
- Change `refetchOnWindowFocus: true` to `refetchOnWindowFocus: false` in global QueryClient config
- This eliminates the double-refetch storm on resume

### File: `src/utils/appLifecycle.ts`
- Increase `RESUME_DEBOUNCE_MS` from 500 to 2000 to prevent triple-firing
- Add a timeout wrapper to `refreshSession()` so it fails fast (4 seconds)
- Add `supabase.removeAllChannels()` + re-subscribe pattern for realtime reconnection

### File: `src/pages/ManageDelivery.tsx`
- Replace the non-functional `AbortController` pattern with `Promise.race` for actual 15-second timeouts on all edge function calls
- Wrap the pre-action `refreshSession()` calls in a 4-second `Promise.race` timeout so the button isn't blocked by a hanging session refresh
- Apply the same fix to `completeDelivery`, `generateAndShowQR`, and `handleQRPaymentComplete`

## Technical Details

```text
BEFORE (on resume from Maps):
  visibilitychange  --> onAppResume() --> refreshSession + invalidate queries
  window.focus      --> onAppResume() --> refreshSession + invalidate queries  (maybe)
  Capacitor event   --> onAppResume() --> refreshSession + invalidate queries
  React Query       --> auto-refetch ALL queries with refetchOnWindowFocus
  = 6-8 session refresh attempts + all queries fetched 2x

AFTER:
  visibilitychange  --> onAppResume() --> refreshSession (4s timeout) + invalidate queries
  window.focus      --> debounced out (2s window)
  Capacitor event   --> debounced out (2s window)
  React Query       --> refetchOnWindowFocus: false (no auto-refetch)
  = 1 session refresh + queries fetched 1x
```

## Expected Result
- "Delivered" button responds within 15 seconds or shows a clear timeout error
- App no longer slows down after returning from Maps/Phone/WhatsApp
- Session refresh doesn't block button clicks indefinitely
- Single controlled refetch on resume instead of a network storm

