
Root cause analysis from current code:

1) The “timeout” in `ManageDelivery` is ineffective  
- `completeDelivery()` and `handleQRPaymentComplete()` create an `AbortController`, but the signal is never passed into the request.  
- In this Supabase version (`@supabase/functions-js`), `FunctionInvokeOptions` does not support `signal`, so this pattern cannot abort `supabase.functions.invoke(...)`.  
- Result: when WebView networking is stale after returning from Maps, the invoke promise can hang and `isCompleting` stays true for a long time.

2) Resume recovery can stall before state refresh  
- `onAppResume()` awaits `refreshSession()`. If token refresh is slow/stuck after background resume, query refresh is delayed.  
- This creates a race where the user taps “Delivered” before session/network are truly healthy.

3) ManageDelivery does not actually refetch order data on resume  
- `useResumeGuard` currently only resets local loading flags.  
- It does not re-run `getOrderDetails(...)`, so the screen can remain stale after app resume.

4) Query invalidation mismatch exists  
- App lifecycle invalidates `['order-details']`, but the query hook uses `['orderDetails', orderId]`.  
- This reduces refresh reliability.

5) Android launch mode config cannot be edited in this repo right now  
- There is no `android/` directory present here, so `AndroidManifest.xml` cannot be changed in-project at this moment.  
- This still needs to be set in the native project (`singleTask`) to prevent activity/webview resume edge cases.

Implementation plan (approved changes to apply next):

A. Harden app resume pipeline (`src/utils/appLifecycle.ts`)
- Add a timeout-safe session refresh wrapper (Promise.race-based), so resume flow cannot block indefinitely.
- Ensure `refreshQueries()` always runs even if refreshSession is slow/fails.
- Add explicit realtime reconnection on resume (`supabase.realtime.disconnect(); supabase.realtime.connect();`) before invalidation/refetch.
- Fix order details invalidation key to `orderDetails` (and keep existing order/assigned/earnings invalidations).

B. Make ManageDelivery resume-aware (`src/pages/ManageDelivery.tsx`)
- Extract a shared `loadOrderDetails()` function (used by initial load and resume).
- Update `useResumeGuard` callback to do:
  1) reset stuck loaders,
  2) safe session refresh with timeout,
  3) refetch current order details,
  4) refetch active order caches (`orders`, `available-orders`, `assigned-orders`).
- Add a short-lived `isResuming` guard state so “Delivered” can’t be tapped during reconnection window.

C. Replace fake abort timeout with real UI timeout behavior (`src/pages/ManageDelivery.tsx`)
- Remove ineffective AbortController usage.
- Wrap each critical async call with Promise.race timeout:
  - `supabase.auth.refreshSession()`
  - `supabase.functions.invoke('unified-complete-delivery', ...)`
  - `supabase.functions.invoke('generate-payment-qr', ...)`
- On timeout: fail fast, clear loading state, show actionable toast (“connection restored slowly, retry once”).

D. Add preflight reconnection before critical actions (`src/pages/ManageDelivery.tsx`)
- Before `Delivered`/QR completion invoke:
  - run timeout-safe `refreshSession()`,
  - read fresh session with `getSession()`,
  - only then call edge function.
- This removes stale-token race after returning from external apps.

E. Fix Capacitor fallback listener cleanup bug (`src/providers/AppProviders.tsx`)
- Refactor the `App.addListener` fallback branch so visibility handler cleanup is guaranteed (current async return path can leak).
- Keep `appStateChange` + `visibilitychange` behavior aligned.

F. Android native config step (external native project)
- In native Android project: set `launchMode="singleTask"` for `MainActivity` in `android/app/src/main/AndroidManifest.xml`.
- Since `android/` is not present in this repo, include this as a required post-pull native step.

Validation plan (end-to-end):
1) Login on device/emulator.
2) Open assigned order → tap “Customer” to launch Maps.
3) Return to app.
4) Immediately tap “Delivered”.
5) Expected:
   - no infinite spinner,
   - either success immediately, or clean timeout message within set limit and successful retry,
   - no manual refresh required.
6) Repeat with QR flow and COD flow.
7) Verify logs show resume pipeline sequence and no stuck `isCompleting`.

Acceptance criteria:
- App resume is detected reliably via Capacitor + visibility fallback.
- Session/API state is refreshed on resume without blocking UI indefinitely.
- Active orders/order details are refreshed on resume.
- “Delivered” works immediately after returning from Maps, without manual app refresh.
