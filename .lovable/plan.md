# Fix: thumbnails missing because items JSON lacks image_url

## Root cause
Looked at real DB rows for this order. Many `orders.items[]` entries store only `id`, `name`, `price`, `quantity`, `seller_id` — no `image_url` field at all (e.g. Ghee/Vegetables/Paneer/Cow Milk/Curd/Buffalo Milk). That's why the UI shows the Package placeholder. Newer orders do include `image_url`, but older ones don't. The UI code is correct; the data is incomplete.

## Fix
Enrich items in `src/services/orderDetails.ts → getRegularOrderDetails` by backfilling missing `image_url` from the `products` table.

Steps:
1. After loading `order`, collect product ids from items that are missing both `image_url` and `image` (use `item.id` or `item.product_id`).
2. If any ids exist, run a single `supabase.from('products').select('id, image_url, images').in('id', ids)` query.
3. Build an id → image_url map (prefer `image_url`, fall back to `images[0]`).
4. Map over `items` and inject `image_url` where missing. Leave other fields untouched.
5. Tolerate failures silently — if the products fetch errors, just return items as-is (UI already falls back to the Package placeholder).

No UI changes needed. The `ManageDelivery.tsx` thumbnail block already handles `image_url`, `images[0]`, and placeholder fallback.

## Files to edit
- `src/services/orderDetails.ts` — add the enrichment step inside `getRegularOrderDetails` before returning.

No DB schema, RPC, edge function, or new dependency changes.
