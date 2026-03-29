
## Fix plan: rebuild `complete_delivery_zepto` from the real schema instead of patching one bad field

### What I confirmed
The current live RPC is broken because it does this:

```sql
SELECT o.*, COALESCE(o.tip_amount, 0) AS resolved_tip INTO v_order ...
...
v_distance_km := COALESCE(p_live_distance_km, v_order.delivery_distance_km, 0);
```

But `v_order` only contains:
- all actual `orders` columns
- `resolved_tip`

And the `orders` table has:
- `distance_km`
- `tip_amount`
- `total`
- `agent_id`
- `assigned_agent_id`

It does **not** have:
- `delivery_distance_km`
- `final_amount`
- `total_amount`
- `delivery_agent_id`

So the current function is not just failing on one field; it was rewritten against columns that do not exist in your schema.

### Root cause
A recent migration recreated `complete_delivery_zepto` using mismatched column names. That is why errors keep changing:
- first `da.user_id`
- then `v_order.delivery_distance_km`
- likely next would be `final_amount`, `total_amount`, or `delivery_agent_id`

### Safe fix
Create one new database migration that **recreates the RPC using the actual schema** and removes all invalid column references.

### What the rebuilt RPC should do
1. Keep a single canonical signature:
   ```sql
   public.complete_delivery_zepto(
     p_order_id uuid,
     p_payment_method text,
     p_agent_id uuid DEFAULT NULL,
     p_live_distance_km numeric DEFAULT NULL
   )
   ```

2. Load the active delivery agent correctly:
   - first by `delivery_agents.agent_id = auth.uid()`
   - fallback to `delivery_agents.id = p_agent_id`

3. Load the order with valid fields only:
   - `o.*`
   - `COALESCE(o.tip_amount, 0) AS resolved_tip`
   - `COALESCE(NULLIF(o.distance_km, 0), 2.5) AS resolved_distance_km`

4. Calculate payout using the approved pricing:
   - base pay = `10`
   - distance rate = `8`
   - distance rounded to 1 decimal
   - tip added to total payout

5. Use valid order fields only:
   - payment total from `o.total`
   - distance from `resolved_distance_km`
   - no `final_amount`
   - no `total_amount`
   - no `delivery_distance_km`

6. Update the order using real columns:
   - `status = 'delivered'`
   - `delivered_at = now()`
   - `payment_method`
   - `payment_status`
   - optionally update `agent_id = v_auth_id` if needed
   - do **not** write to `delivery_agent_id`

7. Insert `delivery_history` using real columns:
   - include `customer_name`, `customer_phone`, `delivery_address`, `items`, `total_amount`, `payment_method`, `payment_status`, `delivery_date`, `completed_at`, `delivery_payout`, `distance_traveled`, `tip_amount`

8. Insert `earnings` without `tip_amount` column, but with payout including tip

9. Insert `agent_earnings_tracking` with `tip_amount` and payout breakdown JSON

10. Preserve idempotency:
   - if already in `delivery_history`, return success with `already_completed: true`

### Important technical detail
The migration should **fully replace** the current function body, not just patch this one line. Otherwise the next invalid column will fail immediately after this one is fixed.

A safe distance section should look like:

```sql
SELECT
  o.*,
  COALESCE(o.tip_amount, 0) AS resolved_tip,
  COALESCE(NULLIF(o.distance_km, 0), 2.5) AS resolved_distance_km
INTO v_order
FROM public.orders o
WHERE o.id = p_order_id
FOR UPDATE;

v_distance_km := COALESCE(p_live_distance_km, v_order.resolved_distance_km, 2.5);
v_rounded_distance := round(v_distance_km::numeric, 1);
```

### Files to change
- `supabase/migrations/<new_timestamp>_rebuild_complete_delivery_zepto_using_real_order_columns.sql`

### Expected result
After this migration:
- the `record "v_order" has no field "delivery_distance_km"` error stops
- delivery completion stops hitting fake-column failures one by one
- regular order completion works again
- earnings include base pay + distance pay + tip correctly

### Technical notes
Confirmed live schema:
- `orders.distance_km` exists
- `orders.tip_amount` exists
- `orders.total` exists
- `delivery_history.tip_amount` exists
- `earnings.tip_amount` does **not** exist
- `agent_earnings_tracking.tip_amount` exists

So the correct fix is a schema-aligned RPC rebuild, not another one-line patch.
