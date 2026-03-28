
## Plan: Make Regular vs Book Now Get Later instantly different on Home

### What I found
- `ManageDelivery` is now classifying the order correctly from raw order fields, which is why that screen looks right.
- On the Home page, both **Nearby Orders** and **Other Orders** already use `OrderCard`, so the problem is **not** that “Other Orders” uses a different component anymore.
- The real issue is that `OrderCard` depends on `order.deliveryType`, and that value comes from `get-available-orders`.
- In `supabase/functions/get-available-orders/index.ts`, the BNGL detection is still fragile:
  - it classifies from the raw `delivery_time_slot`
  - it uses a strict slot pattern / partial UUID fallback
  - it checks date in a loose way (`!== today` instead of truly future)
- So a same-day BNGL order can still fall through as `immediate`, which makes both cards show **Regular** on Home.

### Root cause
```text
Manage Delivery:
raw order fields -> local type check -> correct

Home:
get-available-orders -> calculated_delivery_type -> OrderCard
                         ^
                         this classification is still missing some BNGL cases
```

### Implementation
1. **Fix Home source-of-truth classification**
   - Update `supabase/functions/get-available-orders/index.ts`
   - Normalize the scheduling signal before assigning `calculated_delivery_type`
   - Use this rule consistently:
     - subscription -> `subscription`
     - schedule signal + pending payment -> `book_now_pay_later`
     - schedule signal + not pending -> `scheduled`
     - otherwise -> `immediate`
   - Use a stricter future-date check (`delivery_date > today`)
   - Resolve slot formats consistently so the same BNGL order does not become `Regular` on Home

2. **Keep Home UI visually obvious**
   - Update `src/components/order/OrderCard.tsx`
   - Keep one strong top badge + matching border color for every type:
     - Regular = gray
     - Scheduled = blue
     - Book Now Get Later = amber
     - Subscription = purple
   - Make the type cue more prominent and avoid the card feeling “same at the top”
   - Show the schedule/time row only when relevant, instead of relying on similar-looking generic layout

3. **Ensure it stays different after accept**
   - No separate logic is needed on Home if backend classification is fixed, because the same `OrderCard` is used for:
     - unaccepted available orders
     - agent’s active accepted orders with “Manage Delivery”
   - So fixing `deliveryType` at the source will make the difference visible both **before** and **after** accept on Home

### Files to change
1. `supabase/functions/get-available-orders/index.ts`
2. `src/components/order/OrderCard.tsx`

### Expected result
```text
Home page

Regular order:
- gray Regular badge
- default card style

Book Now Get Later order:
- amber badge
- amber accent/border
- schedule row if slot exists

After accepting:
- the same order keeps its correct visual type on Home
- Manage Delivery remains correct
```

### Technical note
I would **not** change `ManageDelivery` again right now, because that screen is already correct. I also would **not** expand the subscription/daily-order RPC flow unless you want regular orders to appear in `MyDeliveries`, because the current bug is clearly in the Home available-orders pipeline.
