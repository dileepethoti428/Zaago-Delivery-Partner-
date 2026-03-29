

## Fix: PGRST203 Function Overloading Error

### Root cause
The tip support migration created a new version of `complete_delivery_zepto` with 4 parameters (adding `p_live_distance_km`), but the old 3-parameter version was not dropped. PostgREST cannot resolve which function to call when the edge function invokes `supabase.rpc('complete_delivery_zepto', ...)`.

### Fix
One database migration to drop the old 3-parameter overload:

```sql
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text);
```

This leaves only the 4-parameter version (`p_order_id`, `p_agent_id`, `p_payment_method`, `p_live_distance_km`), which already has a default for `p_live_distance_km` so existing callers still work.

### Files
- **DB migration only** — no code changes needed

