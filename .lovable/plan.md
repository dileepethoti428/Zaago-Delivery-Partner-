## Goal
Show each product's unit/volume (e.g. "per litre", "500g") next to the product name everywhere it appears in the delivery partner app.

## Where "product name" is currently rendered
1. **Manage Delivery → Order Items** (`src/pages/ManageDelivery.tsx`, line ~461) — item cards with thumbnail + name.
2. **Delivery History card → items list** (`src/components/delivery/DeliveryHistoryCard.tsx`, line ~146).
3. **Orders page → assigned order card** (`src/components/order/AssignedOrderCard.tsx`, line ~113) — subscription/daily order name row.
4. **Pickup Summary aggregation** (`src/components/delivery/PickupSummaryCard.tsx`) — "Onion — 5", one bullet per product.

Home page's `OrderCard` only shows an item count (no product names), so it's unchanged.

## Data source
`public.products.unit` (text) already stores values like "per litre", "per kg", "500g". It is exposed by the `products_with_sellers` view too. `daily_orders` RPCs currently omit it; regular `orders.items` JSON does not carry it.

## Changes

### 1. Backend data enrichment (no schema change)
- `src/services/orderDetails.ts`
  - `getDailyOrderDetails`: also `select ... , unit` from `products_with_sellers`; add `unit` to the returned item.
  - `getRegularOrderDetails`: extend the existing product back-fill query (already fetching `image_url, images`) to also select `unit` and merge it onto items missing a unit.

- `src/services/assignedOrders.ts`
  - Add `productUnit: string | null` to `AssignedOrder`.
  - After each `transformEnrichedOrders` / `transformDeliveredOrders` call, do one batched `supabase.from('products').select('id, unit').in('id', productIds)` and stamp `productUnit` onto each row. Delivered rows already have `product_unit` from the RPC — reuse that when present.

### 2. UI (append unit as a subtle muted suffix, e.g. `Cow Milk · per litre`)
- `src/pages/ManageDelivery.tsx` — render `item.unit` under or after the product name (small muted text).
- `src/components/delivery/DeliveryHistoryCard.tsx` — same treatment beside `item.name`.
- `src/components/order/AssignedOrderCard.tsx` — append `order.productUnit` after `order.productName`.
- `src/components/delivery/PickupSummaryCard.tsx` — include unit in the aggregation key display (`"Onion (500g)"`) by carrying `productUnit` through the seller map. Quantities still sum per (name+unit).

## Technical notes
- One extra lightweight query per screen load (id-list scoped). No RPC signature changes, so no risk with the memory rule about function overloading.
- Fallback: if `unit` is null/empty, render only the product name (no separator).
- No changes to Home order cards, earnings, or accept/reject flow.