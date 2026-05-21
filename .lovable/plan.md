# Show product images in Manage Delivery → Order Items

## What changes
On the Manage Delivery page, the "Order Items" card will render a small product image next to each item. If an order has more than 5 items, only the first 5 are shown with a "View more (N)" toggle that expands the full list (and collapses back to "Show less").

## Where the image comes from
- **Regular orders**: `orders.items[].image_url` already exists in the JSON (verified). Use it directly.
- **Daily/subscription orders**: `orderDetails.ts → getDailyOrderDetails` currently builds the single item manually without an image. Extend the `products_with_sellers` select to also fetch `image_url`, and include it on the synthesized item.

If `image_url` is missing for a given item, show a neutral placeholder tile (Package icon on `bg-muted`) so the layout stays consistent.

## UI behavior (Order Items card in `src/pages/ManageDelivery.tsx`)
- Each row: 48×48 rounded thumbnail (object-cover) on the left, name + qty in the middle, line total on the right. Existing total-amount footer stays the same.
- When `items.length > 5`:
  - Default: render first 5 only.
  - Footer button under the list: `View more (N-5)` → expands to all items. Becomes `Show less` when expanded.
- When `items.length ≤ 5`: render all, no toggle.
- Use design tokens only (`bg-muted`, `text-muted-foreground`, etc.) — no hardcoded colors.

## Files to edit
1. `src/pages/ManageDelivery.tsx` — replace the Order Items mapping with the thumbnail row + expand/collapse logic (local `useState` for `expanded`).
2. `src/services/orderDetails.ts` — add `image_url` to the daily-order product select and include it on the items array.

No backend, RPC, or DB changes. No new dependencies.
