
## Fix: RLS Policy Bug on `agent_earnings_tracking`

### Root Cause
The SELECT policy on `agent_earnings_tracking` is:
```sql
agent_id IN (SELECT delivery_agents.id FROM delivery_agents WHERE email = auth.email())
```

- `agent_earnings_tracking.agent_id` = auth user UUID (e.g. `17578977-5353-46fd-8ba0-9d2c058adcec`)
- `delivery_agents.id` = internal row UUID (e.g. `c4b29233-d15c-497c-ad01-4c5238be2b4e`)

These are **different values**, so the frontend query returns 0 rows — hence ₹0.

### Fix
Change the policy to compare against `delivery_agents.agent_id` (which holds the auth UUID):

```sql
DROP POLICY "Agents can view own earnings tracking" ON agent_earnings_tracking;

CREATE POLICY "Agents can view own earnings tracking"
ON agent_earnings_tracking FOR SELECT
USING (
  agent_id IN (
    SELECT delivery_agents.agent_id 
    FROM delivery_agents 
    WHERE delivery_agents.email = auth.email() AND delivery_agents.is_active = true
  )
);
```

Or more simply, since `agent_id` IS the auth UUID:
```sql
USING (agent_id = auth.uid())
```

### What changes
- 1 SQL migration to fix the RLS policy — no frontend code changes needed
- The `useAllTimeEarnings` hook already queries correctly with `.eq('agent_id', user.id)` — it just gets blocked by the wrong RLS policy
- After fix, the amber "All Time Earnings" card will show the correct total (~₹270+)

### No frontend changes needed
The frontend hook is already correct. Only the DB policy needs updating.
