# Fix: "Order not found" when tapping middle of an order card

## Root cause

Tapping the middle of an order card on Home navigates to `/order/:id` (`handleViewOrder` in `src/pages/Home.tsx`). `src/pages/OrderDetails.tsx` looks the order up ONLY in the in-memory Zustand cache:

```ts
const order = getOrderById(id || '');
if (!order) return <p>Order not found</p>;
```

`useOrdersStore` is populated by `fetchAvailableOrders` and filtered to statuses `['new','open','packed','assigned','picked_up']`. So the page shows "Order not found" whenever the id isn't in that list, which happens in normal flows:

- Order was just accepted/rejected and removed from the available list
- Order belongs to a subscription/daily order (different id space)
- Page opened via deep link / cold start (store not yet loaded)
- Store was reset on agent switch or logout/login
- The order is assigned to another agent and filtered out

The OrderDetails page never asks the backend, so it can't recover.

## Fix

Fall back to a backend fetch when the store misses, using the existing `useOrderDetails` hook + `getOrderDetails` service. Keep the fast path (store hit) unchanged.

### Changes (frontend only)

1. `src/pages/OrderDetails.tsx`
  - Keep `getOrderById(id)` as the fast path.
  - When the store has no match, call `useOrderDetails(id)` and render from that payload.
  - Show a small loading state while the query is pending; only show "Order not found" after the fetch actually fails (query `isError` or returns null).
  - Map `OrderDetails` (from `services/orderDetails.ts`) into the same shape the page already renders: `pickup` = `seller.address`, `drop` = `customer.address`, `status`, `payout` = `delivery_charge`, `etaMin` fallback (e.g. 15 when unknown), `distanceKm` optional, `customerName` = `customer.name`.
  - Action buttons (Accept / Picked up / Delivered / Cancel) already require the order to be in the store to mutate; when we hydrated from backend, hide those buttons and instead show a single "Manage Delivery" button that routes to `/manage-delivery/:id` (which has its own backend-driven state). This avoids touching business logic.
2. No changes to `services/orders.ts`, `store/orders.ts`, edge functions, or DB.

### Technical details

- Reuse `useOrderDetails(id)` — already handles caching (`staleTime: 30s`), retries, and Auth.
- `getOrderDetails` defaults to `type: 'order'`; if it throws "Order not found", retry once with `type: 'daily'` inside a small wrapper in the page (or extend the hook to accept a type and try both). Prefer a tiny local `tryFetchAnyOrder(id)` helper in `OrderDetails.tsx` that calls `getOrderDetails(id)` and on failure `getOrderDetails(id, { type: 'daily' })`, so the hook stays generic.
- Loading UI: reuse the existing `AppShell` skeleton block (matches other pages) instead of the blank "Order not found" screen.

### Out of scope

- Not touching the Zepto/duplicate-key completion flow (already fixed in the last migration).
- Not changing what statuses populate the store or how Home filters. And note that order information should show after accepting the delivery not before that and if I click on it before it should not open anything page not found also 