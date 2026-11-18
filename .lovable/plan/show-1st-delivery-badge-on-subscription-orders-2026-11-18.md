# Show "1st Delivery" badge on subscription orders

## Goal
On the Orders page, a subscription order that is the customer's very first delivery shows a clear **"1st Delivery"** badge, plus a short reminder for the rider:
"Explain glass bottle handling & cleaning. Hand over the bottle cleaner."

The same badge and reminder also appear on the Manage Delivery page for that order, so the rider sees it at the doorstep.

## How "first delivery" is decided
A subscription order counts as first delivery when that subscription has **no earlier delivered orders**. Once it's delivered, the badge disappears from the next day's order automatically.

## Changes
- In the subscription orders loader, after loading today's list, look up which subscriptions already have a delivered order (one batched query on `daily_orders` with status delivered, grouped by `subscription_id`). Mark the rest as `isFirstDelivery: true`.
- `AssignedOrderCard`: show an amber "1st Delivery" pill next to the `#N` route number, and a small one-line reminder under the address. Add the field to the memo comparison.
- Manage Delivery page: show the same reminder banner above the items list when the order is a first delivery.
- No database changes needed.
