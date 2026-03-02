
## Analysis Summary

After deep inspection of all source files, imports, edge function references, and service calls, here is what is genuinely unused vs. what is active.

### UNUSED FILES (safe to delete)

**src/utils/**
- `src/utils/pricing.ts` — zero imports from any src file (pricing is done server-side in edge functions)
- `src/utils/orders.ts` — zero imports from any src file (`annotateAndFilterOrders` is never called)

**src/store/**
- `src/store/app.ts` — only used in `logoutCleanup.ts` to reset a stub state; the real auth/orders state is in `auth.ts` and `orders.ts`. Contains dummy seed data for a prototype version of the app.

**Edge Functions (not called from any frontend code):**
- `direct-qr-complete` — never invoked from src
- `qr-complete-delivery` — never invoked from src
- `complete-delivery-v2` — never invoked from src (replaced by `unified-complete-delivery`)
- `google-places-autocomplete` — never invoked from src
- `google-places-geocode` — never invoked from src
- `calculate-delivery-pricing` — never invoked from src
- `calculate-distance-eta` — never invoked from src
- `notify-delivery-agents` — never invoked from src
- `send-order-update-notification` — never invoked from src
- `agent-autopay-monitor` — never invoked from src
- `agent-bank-transfer` — never invoked from src
- `agent-topup-razorpay` — never invoked from src
- `agent-topup-verify` — never invoked from src
- `approve-agent` — never invoked from src
- `mark-order-as-packed` — never invoked from src
- `qr-scan-order` — never invoked from src
- `settle-cod-amount` — never invoked from src
- `send-apology-message` — never invoked from src
- `store-player-id` — never invoked from src
- `get-agent-live-earnings` — called only from `src/services/earnings.ts`, but that service function `fetchLiveEarnings` is never called from any hook or page

**Note:** `generate-payment-qr` IS used (ManageDelivery.tsx). `check-payment-status` IS used (RazorpayQRDisplay.tsx). `get-mapbox-token` function exists but mapbox-gl is installed — keeping it safe. `complete-delivery-v2` and `direct-qr-complete` and `qr-complete-delivery` are dead code duplicates of `unified-complete-delivery`.

### CLEANUP IN EXISTING FILES

**`src/store/app.ts`** → Replace dummy orders data with a minimal stub (keep the file since `logoutCleanup.ts` imports `useAppStore`). Remove the 8 dummy `dummyOrders` objects and the prototype `Order`/`Agent` interfaces that duplicate what's in `services/orders.ts`.

**`src/utils/logoutCleanup.ts`** → Remove the `useAppStore` reset block since the store is now a stub.

**`src/services/earnings.ts`** → Remove the unused `fetchLiveEarnings` function and its `LiveEarningsData` type (the `get-agent-live-earnings` edge function it calls is also being deleted).

### WHAT IS KEPT (actively used)

All of these are confirmed active via import tracing:
- All pages in the router
- `src/utils/pricing.ts` — wait, confirmed unused, deleting
- `src/utils/computationCache.ts` — used by `geo.ts` and `pricing.ts` (pricing deleted, but geo.ts still uses it — KEEP)
- All hooks: `useOrders`, `useAssignedOrders`, `useDeliveryHistory`, `useProfile`, `useSettings`, `useResumeGuard`, `useAgentGuard`, `useNetworkStatus`, `useOrderDetails`, `useLocationSyncController`, `useOrdersRealtimeInvalidate`, `useEarnings`
- All stores: `auth`, `orders`, `location`, `lifecycle`
- All UI components under `src/components/`
- All active edge functions: `unified-complete-delivery`, `accept-order`, `cancel-delivery`, `get-available-orders`, `get-agent-assigned-orders`, `get-delivery-history`, `get-order-details`, `get-agent-earnings`, `get-agent-settings`, `update-agent-*`, `update-agent-location`, `ensure-agent-exists`, `send-contact-email`, `send-push-notification`, `generate-payment-qr`, `check-payment-status`, `verify-delivery-otp`, `generate-delivery-otp`, `delete-agent-account`

---

## Plan

### 1. Delete unused utility files
- Delete `src/utils/pricing.ts`
- Delete `src/utils/orders.ts`

### 2. Clean `src/store/app.ts`
- Remove the 8 dummy order objects
- Remove the old prototype `Order` and `Agent` interfaces
- Keep a minimal `useAppStore` stub that `logoutCleanup.ts` can still reset

### 3. Clean `src/services/earnings.ts`
- Remove `fetchLiveEarnings` function and `LiveEarningsData` interface (unused)

### 4. Clean `src/utils/logoutCleanup.ts`
- Remove the `useAppStore` setState block that resets the now-simplified store

### 5. Delete unused edge functions (19 functions)
Remove these from `supabase/functions/`:
`direct-qr-complete`, `qr-complete-delivery`, `complete-delivery-v2`, `google-places-autocomplete`, `google-places-geocode`, `calculate-delivery-pricing`, `calculate-distance-eta`, `notify-delivery-agents`, `send-order-update-notification`, `agent-autopay-monitor`, `agent-bank-transfer`, `agent-topup-razorpay`, `agent-topup-verify`, `approve-agent`, `mark-order-as-packed`, `qr-scan-order`, `settle-cod-amount`, `send-apology-message`, `store-player-id`, `get-agent-live-earnings`

### 6. Deploy updated edge functions
Redeploy the 4 CORS-fixed functions that were previously blocked: `unified-complete-delivery`, `generate-payment-qr`, `cancel-delivery`, `complete-delivery-v2` (wait — `complete-delivery-v2` is being deleted, so only 3: `unified-complete-delivery`, `generate-payment-qr`, `cancel-delivery`).

### Files modified
| Action | Target |
|--------|--------|
| Delete | `src/utils/pricing.ts` |
| Delete | `src/utils/orders.ts` |
| Edit | `src/store/app.ts` — remove dummy data |
| Edit | `src/services/earnings.ts` — remove unused function |
| Edit | `src/utils/logoutCleanup.ts` — remove stale reset |
| Delete folders | 20 edge function directories |
| Deploy | 3 CORS-fixed edge functions |
