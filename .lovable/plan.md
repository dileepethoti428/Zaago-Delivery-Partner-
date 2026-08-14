# Compensation deliveries use the normal delivery flow

Today a compensation (make-up) order on the Orders page is a one-tap "Mark as Delivered": tapping the card calls a single RPC that only flips `vacation_compensations.status` to `delivered`. Nothing else happens — no delivery record, no earnings row — so the delivery never shows up in Delivery History or Earnings.

Goal: a compensation delivery behaves exactly like a subscription delivery — open the Manage Delivery screen, see products, customer, navigation, payment choice, swipe-to-deliver, and get recorded in Delivery History and in the earnings tracking (same subscription-style record, zero-payout, "Subscription" earnings tab).

## What changes for the rider

- Compensation card button reads **Manage Delivery** again (not "Mark as Delivered") and opens the Manage Delivery screen.
- That screen shows the compensation product, quantity/unit, customer address and phone, pickup shop, navigation, cancel, and the swipe-to-deliver track — same as a subscription delivery.
- After swiping, the delivery appears in Delivery History and in Earnings under the subscription/deliveries count, just like a subscription order.

## Technical work

1. **New RPC `get_compensation_details(p_compensation_id)`** (security definer)
   - Resolves the rider's internal `delivery_agents.id` from `auth.uid()` and verifies `vacation_compensations.assigned_agent_id` matches.
   - Returns the same shape the Manage Delivery screen already consumes (`OrderDetails`): status, product/items with image + unit + price, quantity, customer name/phone/address/coords, seller name/address/coords, delivery slot and date, payment mode derived from the parent subscription (`subscriptions.payment_id` present = prepaid/ONLINE, else COD).
   - Compensations carry no `daily_order_id` or `order_id`, so details are assembled from `subscription_id`, `product_id`, `customer_id`.

2. **Rewrite `complete_agent_compensation(p_compensation_id, p_payment_method)`** so it mirrors the subscription completion path in one transaction:
   - marks `vacation_compensations` delivered (idempotent — returns `already_completed` if already delivered),
   - inserts `delivery_history` (order_id = compensation id, agent, customer, items, amount, `payment_method` 'COD'/'ONLINE' to satisfy the existing check constraint, delivery date/slot, `delivery_payout` 0),
   - inserts `agent_earnings_tracking` with `order_type = 'subscription'`, payout 0, `payout_status = 'confirmed'`, `payout_breakdown` flagged as compensation,
   - both inserts guarded against duplicates (`unique_order_delivery`).

3. **Frontend**
   - `src/services/orderDetails.ts`: add a `'compensation'` type to `getOrderDetails` that calls the new details RPC.
   - `src/pages/ManageDelivery.tsx`: when the route type is `compensation`, load via that path and complete through `complete_agent_compensation` instead of the `unified-complete-delivery` edge function (edge function slots are maxed, so completion stays in the RPC). Everything else on the screen — payment dialog, OTP-optional flow, swipe-to-deliver, navigation, cancel — stays as is.
   - `src/pages/MyDeliveries.tsx`: compensation cards navigate to `/manage-delivery/<compensationId>?type=compensation` instead of completing in place.
   - `src/components/order/AssignedOrderCard.tsx`: restore the standard "Manage Delivery" button/tap behaviour for compensations, keeping the amber Compensation badge and missed-date label.

4. Verify against the pending compensation for 14 Aug: open it, complete it, and confirm rows land in `delivery_history` and `agent_earnings_tracking`.
