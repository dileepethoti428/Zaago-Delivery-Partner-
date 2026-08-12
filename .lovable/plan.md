# Show compensation orders in the Orders page

## What's wrong

Compensation orders (the make-up delivery a seller adds when a customer missed a delivery) are stored in their own table, `vacation_compensations` — they are never created as rows in the daily orders table. The Orders page builds its Today / Tomorrow / Delivered lists purely from daily orders, so a compensation order assigned to a partner can never appear there. This is unrelated to the morning/evening filter.

Confirmed example: Onion x1, customer Rakesh, missed 02 Aug 2026, compensation date 12 Aug 2026, assigned to an agent, status pending — it exists only in `vacation_compensations` with no linked daily order.

## What to build

1. Fetch compensation deliveries assigned to the signed-in partner for today and tomorrow and merge them into the existing Today / Tomorrow lists, sorted alongside normal orders by distance.
2. Each compensation order carries the customer's subscription time slot, so it lands in the Morning or Evening filter exactly like their normal delivery (your chosen behaviour). If a subscription has no slot, the order still shows under All.
3. The card shows a clear amber "Compensation" badge with the original missed date, so the partner knows why this extra delivery exists.
4. Marking it delivered updates the compensation record (status delivered + timestamp) instead of touching daily orders.

## Technical details

Database (one migration):
- `get_agent_compensations(p_date date)` — SECURITY DEFINER, returns rows shaped like the existing `get_agent_orders_today` output so the frontend can reuse the same transform: joins `vacation_compensations` -> `subscriptions` (delivery_address, delivery_time_slot, lat/lng), `customers`, `products`, `sellers`. Filters `assigned_agent_id = auth.uid()`, `compensation_delivery_date = p_date`, `status = 'pending'`. Grant EXECUTE to `authenticated`.
- `complete_agent_compensation(p_compensation_id uuid)` — SECURITY DEFINER, sets `status='delivered'`, `delivered_at=now()` only when `assigned_agent_id = auth.uid()`.

Frontend:
- `src/services/assignedOrders.ts`: add `fetchCompensationOrders(date)` and extend `AssignedOrder` with `isCompensation: boolean` and `originalMissedDate: string | null`; reuse `transformEnrichedOrders` + unit enrichment.
- `src/hooks/useAssignedOrders.ts`: add today/tomorrow compensation queries with the same lazy-enable pattern.
- `src/pages/MyDeliveries.tsx`: concatenate compensation orders into the Today / Tomorrow / All lists before `sortByDistance`; counts and the morning/evening buckets then work unchanged since the slot comes from the subscription.
- `src/components/order/AssignedOrderCard.tsx`: amber "Compensation - missed <date>" badge when `isCompensation`.
- Completion: for a compensation order the delivery action calls `complete_agent_compensation` instead of the daily-order completion path.
