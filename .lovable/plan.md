

## Fix: Add `ON CONFLICT` to `delivery_history` insert in `complete_delivery_zepto`

### Problem
The RPC has an idempotency check at the top (SELECT from delivery_history), but there's a race condition: if the function is called twice concurrently, both calls pass the check before either inserts. The second insert then hits the `unique_order_delivery(order_id, agent_id)` constraint and fails with error `23505`.

### Fix
One database migration to recreate `complete_delivery_zepto` with a single change — add `ON CONFLICT (order_id, agent_id) DO NOTHING` to the `delivery_history` INSERT statement, plus return early if the insert didn't actually insert (meaning it was a duplicate).

```sql
-- Current (line ~98):
INSERT INTO public.delivery_history (...) VALUES (...);

-- Fixed:
INSERT INTO public.delivery_history (...) VALUES (...)
ON CONFLICT (order_id, agent_id) DO NOTHING;
```

The `earnings` and `agent_earnings_tracking` inserts already have `ON CONFLICT DO NOTHING`.

### Scope
- Single database migration
- No frontend or edge function changes

### Result
Duplicate delivery completion attempts gracefully succeed instead of crashing with a constraint violation.

