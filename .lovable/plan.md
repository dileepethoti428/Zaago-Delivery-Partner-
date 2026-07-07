## Root cause

The `public.agent_earnings_tracking` table has TWO unique constraints on it:

- `agent_earnings_tracking_order_agent_unique` — `UNIQUE (order_id, agent_id)` — this is the correct one and matches the `ON CONFLICT (order_id, agent_id)` clause used by the `complete_delivery_zepto` RPC.
- `unique_order_tracking` — `UNIQUE (order_id)` alone — legacy, and the source of the 23505 error.

Flow that breaks:

1. Agent A accepts the order → `accept-order` inserts an `agent_earnings_tracking` row `(order_id, agent A, pending)`.
2. Agent A cancels → `cancel-delivery` marks A's row `cancelled` but the row is still there.
3. Agent B accepts → a second `agent_earnings_tracking` row `(order_id, agent B, pending)` gets inserted (this survives only because some paths update in place; when it does insert, it can already fail here on the stale unique).
4. Agent B taps "Delivered" → `complete_delivery_zepto` runs `INSERT ... ON CONFLICT (order_id, agent_id) DO UPDATE`. The `(order_id, agent_id)` conflict target is handled, but Postgres also checks the other unique index `unique_order_tracking (order_id)`, which fires against agent A's cancelled row → `23505 duplicate key value violates unique constraint "unique_order_tracking"`.

Because the RPC aborts, `orders.status` never flips to `delivered`, no `delivery_history` row is written, and no Zepto payout lands in earnings — which matches the second symptom ("history is not following regular payout").

## Fix

One-line schema change: drop the stray legacy unique constraint, keeping the correct composite one.

```sql
ALTER TABLE public.agent_earnings_tracking
  DROP CONSTRAINT IF EXISTS unique_order_tracking;
```

Nothing else needs to change:

- `agent_earnings_tracking_order_agent_unique (order_id, agent_id)` continues to prevent the same agent from being double-credited for the same order.
- `complete_delivery_zepto` already targets `(order_id, agent_id)` in its `ON CONFLICT`, so the RPC will now succeed for the reassigned agent.
- `delivery_history` uses its own `(order_id, agent_id)` uniqueness, unaffected.
- No frontend or edge-function code changes are needed. The earlier `agent_earnings_tracking` row belonging to the cancelled agent stays with `payout_status='cancelled'` (correct history), and a new `confirmed` row for the completing agent will now be inserted.

## Verification after apply

1. Have Agent A accept then cancel the order.
2. Have Agent B accept and mark delivered.
3. Confirm: `orders.status = delivered`, one `delivery_history` row for Agent B, and two `agent_earnings_tracking` rows for that order — A `cancelled` / B `confirmed` with the Zepto payout.