

## Fix: Regular and BNGL Orders Look Identical on Home Page

### Root cause

The backend classification in `get-available-orders/index.ts` line 538-539 includes `delivery_time` as a schedule signal:

```
hasScheduleSignal = hasTimeSlot || hasFutureDate ||
  !!(order.delivery_time && order.delivery_time !== '12:00:00' && order.delivery_time.trim())
```

Regular COD orders likely have a `delivery_time` value (e.g., current time or a default other than `12:00:00`). Combined with `payment_status = 'pending'`, this causes regular orders to be classified as BNGL too.

### Fix 1: Tighten backend schedule signal

Remove `delivery_time` from `hasScheduleSignal`. Only these should count:
- `delivery_time_slot` with a valid range format (e.g., `18:00-20:00`)
- `delivery_date` strictly in the future (not today)

This ensures regular same-day COD orders never trigger BNGL.

### Fix 2: Add explicit type badges to OrderCard (before accepting)

Currently, the Home page `OrderCard` shows a badge only for BNGL and Scheduled. Regular orders have no visual label, making them hard to distinguish at a glance.

Add a colored type badge for ALL order types, matching the style used in `AssignedOrderCard` (which the user says looks perfect for subscription):

```text
Regular:              Gray badge "Regular"
Scheduled:            Blue badge "Scheduled"  
Book Now Get Later:   Amber badge "Book Now Get Later"
Subscription:         Purple badge "Subscription"
```

Each badge will use the `Badge` component with type-specific colors, placed next to the customer name and status pill.

### Files to change

1. **`supabase/functions/get-available-orders/index.ts`** (line 538-539)
   - Remove `delivery_time` from `hasScheduleSignal`
   - Keep only `hasTimeSlot || hasFutureDate`

2. **`src/components/order/OrderCard.tsx`**
   - Import `Badge` and add type-specific badges for all 4 order types
   - Regular = gray, Scheduled = blue, BNGL = amber, Subscription = purple
   - Place badge in the header row next to customer name

### Expected result

```text
Home page cards:
  Regular COD order:  No border accent + gray "Regular" badge
  BNGL order:         Amber border + amber "Book Now Get Later" badge  
  Scheduled order:    Blue border + blue "Scheduled" badge
  Subscription:       Purple border + purple "Subscription" badge
```

