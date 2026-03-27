

## Fix: "Book Now Get Later" Orders Showing as Regular/Scheduled

### Root Cause

The delivery type detection logic in `get-available-orders` edge function (lines 534-599) uses a chain of `if/else if` checks. The `payment_status === 'pending'` check for BNGL is at **line 587** — near the bottom. But BNGL orders also have a `delivery_time_slot` or `delivery_date`, so they get caught earlier at **lines 543-547** and are classified as `'scheduled'` before the BNGL check is ever reached.

### Fix

Move the `payment_status === 'pending'` check **higher** in the chain — right after the `subscription_id` check (line 535) and **before** the `delivery_time_slot`/`delivery_date` checks. This ensures BNGL orders are identified by their payment status first, regardless of whether they also have scheduling fields.

### File to change

**`supabase/functions/get-available-orders/index.ts`**

Current order of checks:
```text
1. subscription_id          → subscription
2. delivery_time_slot       → scheduled    ← BNGL orders caught here!
3. delivery_date (future)   → scheduled    ← or here!
4. delivery_time (non-default) → scheduled
5. paid_subscription        → subscription
6. immediate (recent, no slot) → immediate
7. payment_status=pending   → book_now_pay_later  ← never reached
8. fallback                 → scheduled
```

Fixed order:
```text
1. subscription_id          → subscription
2. payment_status=pending   → book_now_pay_later  ← MOVED UP
3. delivery_time_slot       → scheduled
4. delivery_date (future)   → scheduled
5. delivery_time (non-default) → scheduled
6. paid_subscription        → subscription
7. immediate (recent, no slot) → immediate
8. fallback                 → scheduled
```

After reordering, redeploy the edge function. No frontend changes needed — the frontend mapping (`o.calculated_delivery_type || o.delivery_type`) and amber styling already work correctly.

### Files to change
1. `supabase/functions/get-available-orders/index.ts` — move `payment_status === 'pending'` check to right after subscription check (reorder ~5 lines, no new logic)

