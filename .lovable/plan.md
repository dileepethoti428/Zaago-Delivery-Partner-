

## Fix: BNGL Orders Still Classified as Regular on Home Page

### Root cause

The `hasTimeSlot` check at line 536 uses a loose `.includes('-')` test:

```ts
const hasTimeSlot = !!(order.delivery_time_slot && order.delivery_time_slot.trim() && order.delivery_time_slot.includes('-'));
```

This is likely failing because:
1. The BNGL order's `delivery_time_slot` may be stored as a UUID reference (e.g., `a1b2c3d4-...`) to the `delivery_slots` table rather than a literal `18:00-20:00` string. UUIDs contain `-` so `hasTimeSlot` would be true — but then `payment_status` may not exactly equal `'pending'` (could be `'Pending'`, `null`, or another value).
2. OR `payment_status` is not exactly the string `'pending'` — the check at line 554 does a strict `=== 'pending'` comparison without `.toLowerCase()`.

The fix must handle both:
- Use case-insensitive check for `payment_status`
- Add a proper time-slot regex (`HH:MM-HH:MM`) for `hasTimeSlot` to distinguish real slots from UUIDs
- Add debug logging for order classification so we can trace issues

### Changes

**File: `supabase/functions/get-available-orders/index.ts`**

1. **Fix `hasTimeSlot` check** — use regex `/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/` instead of `.includes('-')` to only match real time ranges, not UUIDs
2. **Fix `payment_status` comparison** — use `.toLowerCase()` for case-insensitive matching: `order.payment_status?.toLowerCase() === 'pending'`
3. **Add UUID slot resolution** — if `delivery_time_slot` is a UUID, resolve it from `delivery_slots` table and treat it as a schedule signal
4. **Add classification logging** — log each order's `delivery_time_slot`, `delivery_date`, `payment_status`, and resulting `calculatedType`

### Technical details

```ts
// Line 536 - Replace loose check with strict regex
const timeSlotValue = order.delivery_time_slot?.toString().trim() || '';
const hasTimeSlot = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(timeSlotValue);
const hasSlotUUID = /^[0-9a-fA-F-]{36}$/.test(timeSlotValue);
const hasScheduleSignal = hasTimeSlot || hasSlotUUID || hasFutureDate;

// Line 554 - Case-insensitive payment_status check
const isPending = order.payment_status?.toLowerCase() === 'pending';

} else if (hasScheduleSignal && isPending) {
  calculatedType = 'book_now_pay_later';
} else if (hasScheduleSignal) {
  calculatedType = 'scheduled';
}
```

### Files to change
1. `supabase/functions/get-available-orders/index.ts` — fix classification logic (~10 lines changed)

### Expected result
- Regular COD order (no time slot, no future date): **Regular** badge
- BNGL order (time slot or UUID slot + pending payment): **Book Now Get Later** amber badge
- Both visually distinct on Home page before accepting

