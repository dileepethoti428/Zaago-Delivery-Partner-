
## Root Cause Analysis — Two Separate Bugs

### Bug 1: Reviews showing 0 — RLS blocks agents from reading their own ratings

The `delivery_agent_ratings` table has RLS enabled. The only SELECT policy is:
- `Users can view their own agent ratings` → `WHERE auth.uid() = user_id`

This policy allows **customers** (who submitted the rating, their `user_id` is stored) to see their own rating. But when the **delivery agent** (Dileep, auth UUID = `17578977-...`) queries this table with:

```sql
SELECT count(*) FROM delivery_agent_ratings WHERE agent_id = 'c4b29233-...'
```

Their `auth.uid()` = `17578977-...` does NOT match `user_id` (which is the customer's UUID). So the query returns 0 rows → `review_count = 0`.

**Fix**: Add a SELECT policy that allows an agent to count/read ratings where `agent_id` matches their own `delivery_agents.id`.

```sql
CREATE POLICY "Agents can view their own ratings"
ON public.delivery_agent_ratings
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.delivery_agents WHERE agent_id = auth.uid()
  )
);
```

### Bug 2: Rating is showing correctly (2.0) ✓

Good news — the trigger IS working now. The DB confirms `average_rating = 2.00` for Dileep (5 ratings: 1, 5, 1, 2, 1 → avg = 2.0). The average_rating on the profile WILL display correctly as "2.0".

### Bug 3: New ratings submitted — are they updating average_rating?

Confirmed: the 5 ratings in the DB are all for Dileep (`agent_id = c4b29233-...`) and the `average_rating` correctly reflects 2.0. The trigger IS working — new ratings after the migration are being counted. ✓

### Summary of what to fix

**Only one migration needed**: Add an RLS policy so agents can read their own ratings count.

**Files to change:**
1. Migration only — add SELECT policy on `delivery_agent_ratings` for agents to view ratings where they are the rated agent.
2. No frontend changes needed — the code in `agentProfile.ts` is correct, the query just returns 0 due to RLS blocking it.

```
Migration:
  ADD POLICY "Agents can view their own ratings"
  ON delivery_agent_ratings FOR SELECT
  USING (agent_id IN (SELECT id FROM delivery_agents WHERE agent_id = auth.uid()))
```

After this fix:
- Dileep will see Reviews: 5 (correct — 5 ratings exist)
- Dinesh will see Reviews: 2 (correct — 2 ratings exist)
- Average rating already shows correctly (2.0 for Dileep, 5.0 for Dinesh)
