## Show pickup shop name on home order cards

Riders need to see which shop they're picking up from, alongside the item count.

### Changes

1. **`src/services/orders.ts`**
   - Add `shopName?: string` to `ZaagoOrder`.
   - In `fetchAvailableOrders` mapping, populate `shopName: o.seller_name || undefined` (already returned by the `get-available-orders` edge function).

2. **`src/components/order/OrderCard.tsx`**
   - Render the shop name next to the existing item-count chip as a second chip on the same row (e.g., a neutral/blue pill with a `Store` icon: `🏪 Sesh Ethoti`).
   - Layout: `<div class="mb-3 flex flex-wrap items-center gap-2">` containing the item-count chip and the shop-name chip. If `shopName` is missing, only the item chip renders (or nothing, unchanged).
   - Add `shopName` to the memo comparator.

No backend, no data-model, no logic changes.