
## Fix plan: remove the duplicate `complete_delivery_zepto` overload causing `PGRST203`

### What I found
The error is confirmed in the live database, not just in code:

```text
public.complete_delivery_zepto(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric
)

public.complete_delivery_zepto(
  p_order_id uuid,
  p_payment_method text,
  p_agent_id uuid,
  p_live_distance_km numeric
)
```

Your edge function calls the RPC with named params:

```ts
supabaseWithAuth.rpc('complete_delivery_zepto', {
  p_order_id: order_id,
  p_agent_id: agent.id,
  p_payment_method: normalizedPayment
})
```

PostgREST cannot decide between the two live overloads, so it throws `PGRST203`.

### Why this happened
Recent migrations recreated the function with a new parameter order, but the old 4-argument version was never dropped.

I verified this from:
- `supabase/functions/unified-complete-delivery/index.ts`
- `supabase/migrations/20260329114738_44db1ef3-1306-4397-a016-b306c81c6d81.sql`
- `supabase/migrations/20260329115835_2184e18b-497f-477c-94c8-820ad810da30.sql`
- live DB function signatures

### Implementation plan
1. Add one new database migration that explicitly drops both conflicting 4-argument signatures:
   - `public.complete_delivery_zepto(uuid, uuid, text, numeric)`
   - `public.complete_delivery_zepto(uuid, text, uuid, numeric)`

2. Recreate exactly one canonical public RPC signature:
   ```sql
   public.complete_delivery_zepto(
     p_order_id uuid,
     p_payment_method text,
     p_agent_id uuid DEFAULT NULL,
     p_live_distance_km numeric DEFAULT NULL
   )
   ```
   This keeps the newer pricing/tip logic and removes ambiguity.

3. Keep the current edge function call unchanged unless we want extra consistency. Since named params are used, it will work once only one overload exists.

4. Re-test delivery completion for a regular order and confirm:
   - no `PGRST203`
   - order moves to delivered
   - `delivery_history` row is created
   - `earnings` row is created
   - tip is included in payout/breakdown

### Technical details
Use a migration shaped like this:

```sql
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, text, uuid, numeric);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id uuid,
  p_payment_method text,
  p_agent_id uuid DEFAULT NULL,
  p_live_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- existing fixed body here
$$;
```

### Scope
- Database migration only
- No frontend changes required
- No edge-function logic change required for the root cause

### Expected result
Delivery completion should stop failing with:
```text
Could not choose the best candidate function...
```
and the existing corrected payout/tip logic will finally execute.
