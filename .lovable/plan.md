

## Fix: Use `orders.status` as the source of truth for idempotency, not `delivery_history`

### Problem
Both the edge function (`unified-complete-delivery`) and the RPC (`complete_delivery_zepto`) check `delivery_history` to decide if an order is "already completed." But stale/orphan records exist in `delivery_history` from prior failed or partial runs where the `orders.status` was never updated to `delivered`. This causes legitimate delivery attempts to be falsely blocked with "Order was already completed."

Confirmed: there are delivery_history rows whose corresponding orders no longer exist or have non-delivered status.

### Fix — two changes

**1. Edge function** (`unified-complete-delivery/index.ts`): Remove the "PRE-COMPLETION GUARD 1" that checks `delivery_history` (lines 253-276). The order status check (GUARD 2, line 278+) already validates the order exists and is in an allowed status — that's the correct guard.

**2. RPC** (`complete_delivery_zepto`): Change the early-exit idempotency check from querying `delivery_history` to checking `orders.status = 'delivered'` directly (which the function already does a few lines later via `SELECT ... FROM orders ... FOR UPDATE`). The delivery_history check is redundant and harmful — remove it, keep only the `v_order.status = 'delivered'` check that already exists.

### Edge function change (lines 253-276 removed)
```typescript
// REMOVE this entire block:
// PRE-COMPLETION GUARD 1: Check if order exists in delivery_history
const { data: existingHistory ... } = await supabase
  .from('delivery_history')
  .select(...)
  .eq('order_id', order_id)
  .maybeSingle();
if (existingHistory) { return ... }
```

### RPC change (remove lines referencing v_existing_history)
```sql
-- REMOVE these lines from the RPC:
SELECT id INTO v_existing_history
FROM public.delivery_history
WHERE order_id = p_order_id LIMIT 1;
IF v_existing_history IS NOT NULL THEN
  RETURN jsonb_build_object('success', true, 'already_completed', true, ...);
END IF;

-- KEEP the existing check that's already there:
IF v_order.status = 'delivered' THEN
  RETURN jsonb_build_object('success', true, 'already_completed', true, ...);
END IF;
```

The `ON CONFLICT (order_id, agent_id) DO NOTHING` on the delivery_history INSERT remains as a safety net for true race conditions — but the early-exit logic now uses the authoritative `orders.status` field.

### Files
- `supabase/functions/unified-complete-delivery/index.ts` — remove delivery_history pre-check
- Database migration — recreate RPC without `v_existing_history` check

### Result
Orders that have a stale `delivery_history` row but `orders.status != 'delivered'` will no longer be falsely blocked. The `orders` table becomes the single source of truth for completion status.

