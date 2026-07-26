## Problem

Two related bugs in the Earnings → Recent Deliveries list:

1. **Wrong "Delivered" badge before delivery.** In `src/components/earnings/RecentEarningsList.tsx`, `getStatusBadge` returns the green `Delivered` badge for **both** `confirmed` **and** `pending` payout statuses. So the moment an order is accepted (which inserts an `agent_earnings_tracking` row with `payout_status = 'pending'` in `accept-order`), it already renders as "Delivered" with a "Payout pending" note next to it — even though nothing has been delivered yet.

2. **Seller-cancelled orders still show as pending earnings.** The agent-side `cancel-delivery` edge function correctly flips the tracking row to `payout_status = 'cancelled'` with `actual_payout = 0`. But when the **seller** (or admin) cancels the order directly on the `orders` / `daily_orders` table, nothing propagates to `agent_earnings_tracking`. The row stays `pending`, so the amount continues to count toward "pending" totals and is shown in Recent Deliveries with the (currently mislabelled) "Delivered" badge.

## Fix

### 1. Correct the status badge (frontend)

In `src/components/earnings/RecentEarningsList.tsx` `getStatusBadge`:
- `confirmed` → green `Delivered` (unchanged)
- `pending` → amber `In Progress` badge (new; not "Delivered")
- `cancelled` → red `Cancelled` (unchanged)

The existing "Payout pending" hint next to pending rows stays.

### 2. Propagate seller/admin cancellations to earnings (DB trigger)

New migration adding a trigger that fires when `orders.status` or `daily_orders.status` transitions **to** `cancelled`:

- Update every matching `agent_earnings_tracking` row (`order_id` for regular, `daily_order_id` for subscription) that is currently `payout_status = 'pending'`:
  - `payout_status = 'cancelled'`
  - `actual_payout = 0`
  - `completed_at = now()`
  - `updated_at = now()`

This mirrors what `cancel-delivery` already does, so seller cancellations behave the same as agent cancellations: the row drops out of pending totals and shows as `Cancelled` in the list.

## Out of scope

- No change to how pending amounts are aggregated (pending is a legitimate bucket for accepted-but-not-yet-delivered orders).
- No change to `accept-order` or `complete_delivery_zepto`.
- No change to the summary cards; they'll reflect the corrected `cancelled` totals automatically.

## Files touched

- `src/components/earnings/RecentEarningsList.tsx` — badge mapping only
- `supabase/migrations/<new>.sql` — trigger on `orders` and `daily_orders`
