## Changes to `src/components/order/OrderCard.tsx`

1. **Reject button → red**
   - Change the Reject `<Button>` from `variant="outline"` to `variant="destructive"` so it renders in the theme's red destructive color (white text on red background).

2. **"Packed" status → green**
   - The status badge is rendered by `<StatusPill status={order.status} />`. Update `src/components/ui/StatusPill.tsx` to map the `packed` status to a green style (green background + green text, matching the existing pill token style), leaving all other statuses unchanged.

No backend, data, or logic changes. Purely presentational.