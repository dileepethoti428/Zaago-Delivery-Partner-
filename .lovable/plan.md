

## Fix: Order Type Badge Wrong + Delivery Schedule in Special Instructions

### Two problems found

**Problem 1 — All COD orders show "Book Now Get Later"**
Both orders have `delivery_date = '2026-03-27'` (today's date). The regular order has `delivery_time_slot = null`, but the ManageDelivery page checks `delivery_date` alone as a schedule signal. Since both are `payment_status = pending`, both become BNGL.

Fix: Only use `delivery_time_slot` (not `delivery_date` alone) as the schedule signal in ManageDelivery. A `delivery_date` equal to today is not a scheduling signal — it just means "deliver today".

**Problem 2 — BNGL order shows delivery timing as "Special Instructions"**
The database has `special_instructions = "Scheduled delivery for 2026-03-27 at 18:00-20:00"` for the BNGL order. This is real DB data but redundant. The fix: filter out this auto-generated text from the special instructions display, and instead show delivery schedule info in a dedicated section.

### Changes

**File 1: `src/pages/ManageDelivery.tsx`**
- Fix Order Type badge: change `hasSchedule` to only use `delivery_time_slot` (not `delivery_date` alone)
- Filter `special_instructions`: if it starts with "Scheduled delivery for", don't show it in the Special Instructions card
- Add a "Delivery Schedule" info card when `delivery_time_slot` exists, showing the slot and date clearly

**File 2: `supabase/functions/get-available-orders/index.ts`**
- Tighten `hasScheduleSignal`: require `delivery_time_slot` with a valid slot format, or `delivery_date` that is strictly in the future (not today)
- This prevents regular same-day COD orders from being classified as BNGL

### Expected result
```
Regular COD order:
  - Order Type badge: "Regular"
  - No special instructions shown
  - No delivery schedule section

BNGL order:
  - Order Type badge: "Book Now Get Later"
  - Delivery Schedule section showing "18:00-20:00" and date
  - Special Instructions only if there are real instructions
```

### Files to change
1. `src/pages/ManageDelivery.tsx`
2. `supabase/functions/get-available-orders/index.ts`

