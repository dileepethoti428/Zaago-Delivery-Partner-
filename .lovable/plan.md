
## Root Cause: Two Different UUIDs

The `agent_earnings_tracking.agent_id` column stores `delivery_agents.id` (internal primary key = `c4b29233...`) — NOT the auth user UUID (`17578977...`).

This means:
1. **RLS policy** `agent_id = auth.uid()` → FAILS because auth.uid() = `17578977...` but column has `c4b29233...`
2. **Frontend hook** `.eq('agent_id', user!.id)` → FAILS for same reason — `user.id` is auth UUID but column stores delivery_agents internal id

The edge function works fine because it uses **service_role** key (bypasses RLS) and queries by `delivery_agents.id` after looking up the agent internally.

### The Fix

**Fix 1 — RLS policy** (migration): Change the policy to correctly join through `delivery_agents`:

```sql
DROP POLICY IF EXISTS "Agents can view own earnings tracking" ON agent_earnings_tracking;

CREATE POLICY "Agents can view own earnings tracking"
ON agent_earnings_tracking FOR SELECT
USING (
  agent_id IN (
    SELECT id FROM delivery_agents WHERE agent_id = auth.uid()
  )
);
```

**Fix 2 — Frontend hook**: Update `useAllTimeEarnings` to first look up the internal `delivery_agents.id` for the current auth user, then query earnings by that id.

### Files to change
- New migration SQL to fix the RLS policy
- `src/hooks/useAllTimeEarnings.ts` — add delivery_agents lookup step before querying earnings
