
## What I found

The problem is not the color component itself. The real issue is the **order-type detection logic**.

I checked the actual two orders in the database:

```text
57404118...  payment_status=pending  delivery_time_slot=18:00-20:00
4cdf4472...  payment_status=pending  delivery_time_slot=null
```

So:
- one order is clearly **scheduled / BNGL** because it has a delivery slot
- the other is **regular / immediate** because it has no slot

But the current backend logic in `supabase/functions/get-available-orders/index.ts` does this:

```ts
if (subscription) -> subscription
else if (payment_status === 'pending') -> book_now_pay_later
else if (delivery_time_slot...) -> scheduled
...
```

That means **both COD orders become BNGL**, because both have `payment_status = 'pending'`.

There is a second issue too:
- `ManageDelivery.tsx` also treats `payment_status === 'pending'` as BNGL
- `assignedOrders.ts` does not actually preserve BNGL at all for accepted orders

## Root cause

`payment_status = pending` is **not enough** to identify BNGL.

Regular COD orders are also pending until delivery.

So BNGL should be derived from a combination like:
- unpaid COD
- and a real scheduling signal (`delivery_time_slot`, future `delivery_date`, or valid non-default `delivery_time`)

## Plan

### 1) Fix backend classification in available orders
Update `supabase/functions/get-available-orders/index.ts` so the type logic becomes:

```text
subscription                    -> subscription
scheduled + unpaid              -> book_now_pay_later
scheduled + not unpaid          -> scheduled
no schedule markers             -> immediate
```

More specifically:
- do **not** use `payment_status === 'pending'` by itself for BNGL
- first detect whether the order is scheduled
- if scheduled and unpaid/COD, mark as `book_now_pay_later`
- if not scheduled, fallback to `immediate`

This will make the two current orders render differently before acceptance.

### 2) Fix Manage Delivery order-type badge
Update `src/pages/ManageDelivery.tsx` so it does not use this rule:

```ts
order.payment_status === 'pending' => BNGL
```

Instead derive the badge from:
- `subscription_id` => Subscription
- schedule markers + pending/COD => Book Now Get Later
- schedule markers without BNGL condition => Scheduled
- otherwise => Regular

That fixes the wrong badge after acceptance/opening the order.

### 3) Fix accepted-orders mapping
Update `src/services/assignedOrders.ts` so accepted orders also carry correct `deliveryType`.

Right now it only does:
- subscription
- scheduled if time slot exists
- otherwise immediate

It should instead support:
- subscription
- book_now_pay_later when scheduled + unpaid marker is available from RPC
- scheduled
- immediate

If the RPC does not currently return the payment/schedule fields needed for BNGL, then the RPCs behind:
- `get_agent_orders_today`
- `get_agent_orders_tomorrow`
- `get_agent_orders_upcoming`

will need to expose the required columns so frontend mapping is correct.

### 4) Keep AssignedOrderCard visuals aligned
`src/components/order/AssignedOrderCard.tsx` already has amber/blue/purple styles.
After fixing the data mapping, it should naturally show:
- Regular = default
- Scheduled = blue
- BNGL = amber
- Subscription = purple

So this file may need little or no UI change, but I would verify the label text remains consistent.

## Files likely to change

1. `supabase/functions/get-available-orders/index.ts`
2. `src/pages/ManageDelivery.tsx`
3. `src/services/assignedOrders.ts`
4. Possibly the SQL/RPC source for assigned orders if payment/schedule fields are missing there

## Expected result

```text
Before accepting:
- Regular COD order: default card
- BNGL order: amber card/badge

After accepting:
- Regular COD order: Regular badge
- BNGL order: Book Now Get Later badge
- Scheduled prepaid order: Scheduled badge
- Subscription order: Subscription badge
```

## Technical note

The Stack Overflow-style guidance about moving `payment_status === 'pending'` earlier is not correct for your current data model, because your regular COD orders are also `pending`. In this project, BNGL must be detected using **schedule signal + unpaid status**, not unpaid status alone.
