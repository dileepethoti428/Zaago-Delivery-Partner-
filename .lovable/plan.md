## Root cause

React error #31 = trying to render a plain object as a text node. The decoded keys are `{city, state, address, pincode}` — that's an address JSON coming back from the backend.

In `src/services/orders.ts` (line 100), the mapper does:
```
pickup: o.pickup_address || o?.seller?.address_line || 'Pickup location',
```
`o.pickup_address` is the object `{ address, city, state, pincode }`, so `pickup` is stored as an object and then `OrderCard.tsx` line 177 renders `{order.pickup}` — React blows up.

The drop-address branch has the same class of bug: it looks for `o.address.addressLine1`, but the actual shape is `{ address, city, state, pincode }`, so the "if" is false, and it falls back to `o.address?.full_address || 'Delivery location'`. That happens to be a string, so `drop` doesn't crash — but it also never shows the real address.

This started surfacing now because with the 10km fix, the endpoint is finally returning orders, so `OrderCard` actually renders these fields.

## Fix

Edit **only** `src/services/orders.ts` inside `fetchAvailableOrders` (and mirror the same helper in `fetchOpenOrders` if it builds pickup/drop the same way — I'll check when implementing). Introduce a small local helper:

```ts
const formatAddress = (a: any): string => {
  if (!a) return '';
  if (typeof a === 'string') return a;
  const parts = [
    a.addressLine1, a.addressLine2,   // legacy shape
    a.address,                         // current shape
    a.city, a.state, a.pincode,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : (a.full_address || '');
};
```

Then:
- `pickup: formatAddress(o.pickup_address) || o?.seller?.address_line || 'Pickup location'`
- `drop: formatAddress(o.address) || 'Delivery location'`

Nothing else changes — no UI, no backend, no other hook.

## Verification

- Home renders order cards again with real "Pickup" and "Drop" address strings, no error boundary.
- Console has no more Minified React error #31.
- Backend responses still control payout/distance/etc. as before.

## Not changed

- Edge function `get-available-orders` (the 10km fix stays as-is).
- `OrderCard` component.
- Assigned/subscription order services (they format address independently).
