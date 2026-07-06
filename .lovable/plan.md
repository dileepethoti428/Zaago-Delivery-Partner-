# Home Page Order Card Improvements

Refine the "Available Orders" cards on Home so a rider on a moped can scan them faster and act more safely.

## Changes

### 1. Strip Plus Codes from addresses
Plus Codes like `2G36+F7P` are meaningless to a rider. Strip them from both pickup and drop text before display.

- Add a small helper `stripPlusCode(text)` in `src/utils/deliveryHelpers.ts` (regex: `\b[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\b`, then collapse leftover `, ,` and trim).
- Apply it in `src/services/orders.ts` `fetchAvailableOrders` mapping (pickup/drop) so every consumer benefits.

### 2. Dedupe repeated address fragments
"Galiveedu, Andhra Pradesh, 516267" often repeats 2–3 times. Add a `dedupeAddressParts(text)` helper (splits on `,`, trims, drops case-insensitive duplicates preserving first occurrence) and apply in the same mapping step after Plus Code stripping.

### 3. Show item count only (no weight / no packed contents)
Backend already returns `items[]` in each order row from `get-available-orders`. In `fetchAvailableOrders`:
- Compute `itemCount = Array.isArray(o.items) ? o.items.reduce((n,i)=>n + (Number(i.quantity)||1), 0) : 0`.
- Add `itemCount?: number` to the `ZaagoOrder` type.

In `OrderCard`:
- Above the pickup/drop block, render a compact chip: `📦 3 items` when `itemCount > 0`. No weight, no item names.
- Keep existing customer name, status pill, type badges.

### 4. Swipe-to-accept button (replaces flat Accept)
Only when the order is unassigned (current Accept/Reject branch). Keep Reject as a plain outline button underneath. Assigned-to-me and Taken states stay as normal buttons.

- New component `src/components/order/SwipeToAccept.tsx`: a horizontal track with a draggable thumb (pointer events, no external lib). Threshold = 75% of track width. Triggers `onAccept` at threshold; springs back if released early. Disabled state when `isProcessing`.
- Layout matches the reference screenshot: rounded pill, primary-colored square thumb with arrow, "Swipe to accept" label centered.
- One-handed safe: min 56px tall, active while pointer is down anywhere on the card, prevents accidental card `onClick` via `stopPropagation`.
- Reject stays as a full-width outline `Button` below the swipe track.

## Files touched
- `src/utils/deliveryHelpers.ts` — add `stripPlusCode`, `dedupeAddressParts`.
- `src/services/orders.ts` — apply helpers to pickup/drop, add `itemCount` to `ZaagoOrder`.
- `src/components/order/OrderCard.tsx` — render item-count chip, use `SwipeToAccept` in the unassigned branch, stack Reject below.
- `src/components/order/SwipeToAccept.tsx` — new component.

## Out of scope
- Changing Delivery History, Order Details, or Manage Delivery cards.
- Backend/edge function changes (edge deploy limit reached; all logic stays in frontend mapping).
- Weight, item names, or packed-contents details on the card.
