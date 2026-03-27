
## Plan: Make order type clear before and after accepting

### What I found
- Before accepting, the Home card already supports visual types:
  - regular/immediate = default
  - scheduled = blue
  - subscription = purple
  - BNGL = amber
- But the backend classification in `get-available-orders` still has a bad fallback:
  - anything not matched becomes `scheduled`
  - so some regular orders can still be mislabeled as scheduled
- After accepting, the assigned-order flow does not carry any explicit `deliveryType` at all:
  - `src/services/assignedOrders.ts` only exposes `isSubscription`
  - `src/components/order/AssignedOrderCard.tsx` shows subscription only, and otherwise just prints the time slot text
  - `src/pages/ManageDelivery.tsx` also only distinguishes subscription vs payment status, not scheduled vs regular

### Fix approach
1. Fix delivery type calculation at the source in `supabase/functions/get-available-orders/index.ts`
   - keep `subscription` first
   - keep `book_now_pay_later` before scheduled checks
   - classify `scheduled` only when there is a real future slot/date/time
   - change the final fallback to `immediate`, not `scheduled`

2. Carry order type into accepted/assigned orders
   - extend `AssignedOrder` with a `deliveryType` field
   - derive it in `src/services/assignedOrders.ts` from the RPC row:
     - `subscription_id` → `subscription`
     - valid `delivery_time_slot` → `scheduled`
     - otherwise → `immediate`
   - if available, also retain date/time-slot info for display

3. Update My Deliveries cards
   - in `src/components/order/AssignedOrderCard.tsx`
   - add the same visual language as Home:
     - scheduled = blue badge/accent
     - subscription = purple badge
     - immediate/regular = plain/default
   - do not mark every time-slot order as subscription
   - make the time slot visually obvious for scheduled orders

4. Update Manage Delivery header/details
   - show an explicit order type badge near the top:
     - Regular
     - Scheduled
     - Subscription
     - BNGL when applicable for regular orders
   - so the partner can still identify type after opening the accepted order

### Files to change
1. `supabase/functions/get-available-orders/index.ts` — fix classification fallback/order
2. `src/services/assignedOrders.ts` — add `deliveryType` mapping for accepted orders
3. `src/components/order/AssignedOrderCard.tsx` — add scheduled vs regular visual differentiation
4. `src/pages/ManageDelivery.tsx` — show clear order-type badge/details after acceptance

### Expected result
```text
Before accepting:
- Regular: default card
- Scheduled: blue card accent + scheduled badge
- Subscription: purple badge
- BNGL: amber badge/accent

After accepting:
- Regular: clearly labeled Regular
- Scheduled: clearly labeled Scheduled with slot
- Subscription: clearly labeled Subscription
```

### Technical notes
- The current issue is not just styling; it is partly a backend classification problem and partly missing type propagation in assigned-order screens.
- No database schema change should be needed if we derive the accepted-order type from existing fields already returned by the RPCs.
