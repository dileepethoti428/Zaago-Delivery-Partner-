
## Root Cause: Missing Trigger + Wrong Column in Profile Fetch

Two bugs confirmed by database inspection:

### Bug 1: No trigger attached to `delivery_agent_ratings`

The function `update_delivery_agent_rating_stats()` EXISTS in the database but there is **no trigger attached to the `delivery_agent_ratings` table**. This means when a customer submits a rating, the `delivery_agents.average_rating` column is NEVER updated — it stays at 0.00 forever.

Proof from DB query:
- Dinesh has 2 ratings both = 5 stars → correct avg should be **5.0** but `delivery_agents.average_rating = 0.00`
- Dileep has 1 rating = 5 stars → correct avg should be **5.0** but `delivery_agents.average_rating = 0.00`

### Bug 2: Profile page fetches by `agent_id` (auth UUID) but stats card reads from the same row

`delivery_agents` table has TWO different UUID columns:
- `id` — the table's primary key (e.g. `70dfec40-...`) — this is what `delivery_agent_ratings.agent_id` references
- `agent_id` — the auth UUID (e.g. `677b89fb-...`) — this is what the app queries by

The profile page fetches by `agent_id` (auth UUID) which is correct and returns the row. But the `average_rating` column on that row is always 0 because the trigger never fires to update it.

### Fix: Two changes

**1. Create the missing trigger** (migration)

```sql
CREATE TRIGGER update_agent_rating_after_insert
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_agent_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_delivery_agent_rating_stats();
```

This will auto-update `average_rating` on `delivery_agents` every time a customer submits a rating.

**2. Backfill existing ratings** (data fix)

There are already 3 ratings in the table that were never applied. Run an UPDATE to sync them now:

```sql
UPDATE delivery_agents d
SET average_rating = sub.avg_rating, updated_at = now()
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) as avg_rating
  FROM delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE d.id = sub.agent_id;
```

### What the profile page shows after fix

- Dinesh: **5.0 ⭐** (was showing 0)
- Dileep: **5.0 ⭐** (was showing 0)
- All future customer ratings will auto-update immediately

### Files to change
1. **Migration** — create the missing trigger + backfill existing ratings
2. **No frontend changes needed** — `Profile.tsx` already renders `average_rating` correctly with `Number(agentProfile.average_rating).toFixed(1)`
