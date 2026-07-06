# Fix: "Order not found" when tapping a Delivery History card

## Problem
Tapping the middle of a card in Delivery History navigates to `/order/:id` (OrderDetails page). That page reads from `useOrdersStore`, which only holds active/open orders — completed deliveries aren't there, so it always renders "Order not found".

The card already has full delivery details available inline via the "More" collapsible (address, items, payment, payout, distance, duration, rating, notes, proof). A navigation target isn't needed.

## Fix
In `src/components/delivery/DeliveryHistoryCard.tsx`:

- Remove the `navigate(`/order/${delivery.order_id}`)` behavior from the card's `onClick`.
- Make tapping anywhere on the card toggle the expanded/collapsed state (same as pressing "More"), so users get all the info in-place.
- Keep the existing `stopPropagation` on the phone button and the "More" chevron so those still work independently.

No changes to routing, OrderDetails, data fetching, or the history query.

## Out of scope
Building a dedicated "completed order details" page — not needed since the card already shows all fields. Can be added later if you want a full-screen view.
