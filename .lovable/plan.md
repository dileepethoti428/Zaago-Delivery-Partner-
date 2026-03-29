

## Fix: FK violation on `earnings` table during delivery completion

### Root cause
The `complete_delivery_zepto` database function sets `v_agent_id := auth.uid()` (the Supabase Auth UUID) and uses it everywhere. But `earnings.agent_id` has a foreign key referencing `delivery_agents.id` — which is a **different UUID** than the Auth user ID. So the insert fails.

The edge function already passes the correct `delivery_agents.id` as `p_agent_id`, but the RPC ignores it and uses `auth.uid()` instead.

### Fix
One database migration to update the `complete_delivery_zepto` function. Change the problematic inserts/updates to use `p_agent_id` instead of `v_agent_id` for tables that reference `delivery_agents.id`:

- **Line 113** (`earnings` insert): `v_agent_id` → `p_agent_id`
- **Line 110** (`delivery_agents` update): `WHERE agent_id = v_agent_id` → `WHERE id = p_agent_id`
- **Line 117-126** (`agent_wallet` insert/upsert): `v_agent_id` → `p_agent_id`
- **Line 129** (`agent_wallet_transactions` insert): `v_agent_id` → `p_agent_id`
- **Line 139** (`agent_earnings_tracking` update): `v_agent_id` → `p_agent_id`

Keep `v_agent_id` (auth.uid()) only for the authentication check and the idempotency check on `delivery_history` (which has no FK to `delivery_agents`). The `delivery_history` insert on line 88 should also use `p_agent_id` for consistency.

### File
- **Database migration only** — recreate the `complete_delivery_zepto` function with corrected agent ID references. No edge function or frontend changes needed.

