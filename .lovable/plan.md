

## Plan: Add Amber Color for "Book Now Pay Later" Orders

### What's happening now
The backend returns `calculated_delivery_type: 'book_now_pay_later'` for unpaid scheduled orders (line 588 of edge function). The frontend `ZaagoOrder.deliveryType` type doesn't include this value, and `OrderCard` only checks for `'scheduled'` (blue) and `'subscription'` (purple). BNGL orders render with no visual distinction.

### Changes

**File 1: `src/services/orders.ts`**
- Add `'book_now_pay_later'` to the `deliveryType` union type

**File 2: `src/components/order/OrderCard.tsx`**
- Add `const isBookNowGetLater = order.deliveryType === 'book_now_pay_later'`
- Add amber left border: `isBookNowGetLater && "border-l-4 border-l-amber-500"`
- Add a small amber badge/label showing "Book Now Get Later" (similar style to ScheduledBadge but amber)
- Add `deliveryType` value to memo comparison (already done)

### Visual result
```
Immediate:            No left border
Scheduled:            Blue left border + blue badge
Subscription:         Purple left border
Book Now Get Later:   Amber left border + amber badge (NEW)
```

### Files to change
1. `src/services/orders.ts` — type update (1 line)
2. `src/components/order/OrderCard.tsx` — amber border + badge (5-10 lines)

