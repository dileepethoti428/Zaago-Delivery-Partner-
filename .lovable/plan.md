

## Fix: Remove `tip_amount` from earnings insert

### Root cause
The `earnings` table does not have a `tip_amount` column. The RPC tries to insert into it on line 156.

### Fix
One database migration to recreate `complete_delivery_zepto` with the `tip_amount` reference removed from the `earnings` INSERT (lines 150-166). The tip is already included in the `amount` field (line 92: `v_payout = base + distance + tip`), so no data is lost.

The tip is still tracked in:
- `delivery_history.tip_amount` (has the column)
- `agent_earnings_tracking.tip_amount` (has the column)
- `payout_breakdown` JSON (includes tip_amount)

### Change
In the `earnings` INSERT, remove the `tip_amount` column and value:

```sql
-- Before (broken):
INSERT INTO public.earnings (agent_id, order_id, amount, distance_km, payment_method, tip_amount, status)
VALUES (v_da_id, p_order_id, v_payout, v_distance_km, v_normalized_payment, v_tip, 'completed');

-- After (fixed):
INSERT INTO public.earnings (agent_id, order_id, amount, distance_km, payment_method, status)
VALUES (v_da_id, p_order_id, v_payout, v_distance_km, v_normalized_payment, 'completed');
```

### Files
- Database migration only — drop and recreate `complete_delivery_zepto` with same logic minus the bad column reference.

