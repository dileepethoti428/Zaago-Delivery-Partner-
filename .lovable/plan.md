
## Goal

When a partner taps **Delivered** on a *regular prepaid* order, show a 4-digit OTP dialog that verifies via the existing `verify_delivery_otp` RPC. OTP is **optional** — a "Skip & Deliver" action still completes the delivery without OTP. COD and scheduled/subscription/BNGL orders keep today's exact flow (no OTP).

## Scope

- File: `src/pages/ManageDelivery.tsx` (wire eligibility + open dialog).
- New file: `src/components/delivery/DeliveryOtpDialog.tsx` (dialog + InputOTP + verify logic).
- New file: `src/utils/otpQueue.ts` (tiny localStorage queue for offline retries).
- No schema changes. No edge function changes. The RPC `verify_delivery_otp` and `profiles.delivery_otp` already exist and are shared with the customer app.

## Eligibility (must all be true)

Compute an `otpEligible` boolean alongside the existing `handleMarkAsDelivered` checks:

- `!order.subscription_id`
- No time slot: `!(order.delivery_time_slot && order.delivery_time_slot.includes('-'))` — excludes Scheduled and Book-Now-Get-Later.
- Paid online: `order.payment_status === 'paid' || order.payment_method?.toUpperCase() === 'ONLINE'`.

When `otpEligible` → open `DeliveryOtpDialog` instead of immediately calling `completeDelivery('ONLINE')`. Everything else (COD path, payment method dialog, QR flow) stays unchanged.

## DeliveryOtpDialog behavior

- shadcn `Dialog` containing `InputOTP` with `maxLength={4}`, numeric-only pattern, autoFocus.
- Primary action **Verify & Deliver**: enabled once 4 digits entered.
  - Calls `supabase.rpc('verify_delivery_otp', { p_order_id: order.id, p_otp: code, p_agent_id: profile.user_id })`.
  - On `{ success: true }` → RPC has already marked the order delivered. Close dialog, show green ✓ toast "Delivery verified", clear the same React Query caches `completeDelivery` clears, and `navigate('/my-deliveries', { replace: true })`. Do **not** call `unified-complete-delivery` again.
  - On failure → show inline error with `attempts_remaining` from the RPC response. Clear the input. If the RPC returns `locked: true` (or after 5 client-side failures as a safety net) disable the input and Verify button, show "Locked — use Skip & Deliver".
  - Never log or display the OTP value; never read `profiles.delivery_otp` in the client.
- Secondary action **Skip & Deliver (no OTP)**: always visible. Closes the dialog and calls the existing `completeDelivery('ONLINE')` unchanged. This preserves the "OTP is optional" requirement.
- Cancel (X / backdrop) just closes without side effects.

## Offline fallback

`src/utils/otpQueue.ts` exposes `enqueue({ orderId, otp, agentId, ts })` (localStorage array, capped at 20) and `flush()` that iterates entries and calls the RPC, removing entries on success or on any non-network error (bad OTP, locked, already delivered — no point retrying).

- Dialog Verify handler: if `navigator.onLine === false` or the RPC throws a network error, enqueue and show toast "No network — will verify when back online. You can also Skip & Deliver now." Keep dialog open so the partner can choose to skip.
- `flush()` is triggered from `useNetworkStatus` transitioning offline → online (single `useEffect` in `App.tsx` or the existing `NetworkStatusWrapper`). Failures during flush are silent; successes emit a toast "Pending OTP verified".

## Security notes honored

- RPC is `SECURITY DEFINER`; client never selects `profiles.delivery_otp`.
- No console/toast ever prints the entered code.
- Rate limiting and lockout are enforced server-side; client only mirrors state from the RPC response.

## Out of scope (matches your list)

- No SMS/WhatsApp OTP delivery.
- No admin reset UI.
- No backfill for historical orders.
- COD, Scheduled, BNGL, and Subscription orders continue to complete with **no OTP prompt**.

## Technical details

- `InputOTP` import: `@/components/ui/input-otp` (already in the project).
- RPC types are already generated (`verify_delivery_otp` in `types.ts` line 11184), so the call is fully typed.
- Cache clearing after success uses the same three `queryClient.removeQueries` calls already in `completeDelivery`.
- Uses `profile.user_id` from `useAuthStore` as `p_agent_id`, matching the pattern in `handleCancel`.

```text
Delivered tap
   │
   ├── regular + paid online? ──► DeliveryOtpDialog
   │                                   ├── Verify → RPC → done
   │                                   └── Skip   → completeDelivery('ONLINE')
   │
   └── otherwise ─────────────────► existing flow (COD dialog / QR / auto-complete)
```
