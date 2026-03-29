
## Fix plan: replace the live RPC signature that the edge function actually calls

### What I found
The failure is real and the root cause is now confirmed in the live database:

- `earnings.agent_id` has FK to `delivery_agents.id`
- Your logged-in auth user is `677b89fb-f561-4ef4-b9c9-c82c338a426c`
- Your delivery agent row is `70dfec40-8e01-47ae-970a-dc3337a55d88`
- The edge function sends `p_agent_id = 70dfec40-8e01-47ae-970a-dc3337a55d88`

But the **live** 4-parameter RPC being called is still this signature:
```sql
public.complete_delivery_zepto(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric
)
```

and its body still does:
```sql
v_agent_id := auth.uid();
INSERT INTO earnings (agent_id, ...) VALUES (v_agent_id, ...);
```

So it inserts the auth UUID into a column that expects `delivery_agents.id`, which causes the FK error.

### Why the previous fix did not work
The last migration in the repo recreated a different function signature:
```sql
complete_delivery_zepto(p_order_id uuid, p_payment_method text, p_live_distance_km numeric)
```

That fixed the wrong overload. The edge function does **not** call that one. It calls the overload with `p_agent_id`, and that overload is still broken in production.

### Exact fix
Create one new database migration that:

1. Drops the broken 4-arg overload:
```sql
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text, numeric);
```

2. Recreates that same 4-arg overload with corrected ID handling:
- keep `auth.uid()` only for authentication
- resolve/validate the internal delivery agent row
- use `p_agent_id` (or a verified internal ID variable derived from it) for:
  - `delivery_history.agent_id`
  - `delivery_agents` update
  - `earnings.agent_id`
  - `agent_wallet.agent_id`
  - `agent_wallet_transactions.agent_id`
  - `agent_earnings_tracking.agent_id`

3. Keep the current return shape expected by the edge function:
```sql
{
  success,
  payout_amount,
  distance_km,
  payout_breakdown,
  already_completed?,
  tip_amount?
}
```

### Recommended implementation details
Use this logic inside the recreated 4-arg function:

- `v_auth_id := auth.uid()`
- verify authenticated user exists
- verify `p_agent_id` belongs to that auth user:
```sql
SELECT id INTO v_da_id
FROM public.delivery_agents
WHERE id = p_agent_id
  AND agent_id = v_auth_id
  AND is_active = true;
```

That is better than trusting `p_agent_id` blindly.

Then use `v_da_id` everywhere for FK-backed tables.

### Important cleanup
Because this function has been overloaded repeatedly, the migration should also explicitly drop the obsolete signatures to avoid future confusion:

```sql
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, text);
```

Then recreate only the canonical one your edge function uses:
```sql
public.complete_delivery_zepto(uuid, uuid, text, numeric DEFAULT NULL)
```

### Files affected
- New SQL migration in `supabase/migrations/`

### Expected result after fix
When delivery completes:

- `earnings.agent_id` will receive `70dfec40-8e01-47ae-970a-dc3337a55d88`
- FK will pass
- tip will still be added into payout
- the edge function should stop returning the FK error

### Technical note
This is not an edge-function bug now. The edge function is already passing the correct `delivery_agents.id`. The remaining problem is that the live RPC overload being resolved by PostgREST is still the old broken body.
