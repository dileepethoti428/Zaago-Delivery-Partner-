## Fix: Profile rating shows 0 — missing trigger on `delivery_agent_ratings`

### Root cause
The `delivery_agents.average_rating` column for Dileep is `0.00`, but `delivery_agent_ratings` actually has 2 ratings averaging **5.0** for that agent.

The function `update_delivery_agent_rating_stats()` exists in the database, but **no trigger is attached** to the `delivery_agent_ratings` table — so when ratings are inserted, `delivery_agents.average_rating` is never updated. Confirmed via `information_schema.triggers` (zero rows for that table).

The Profile page reads `agentProfile.average_rating` directly from `delivery_agents` (`src/pages/Profile.tsx` line ~204), which is why it renders `0.0`.

Similarly, `review_count` on the profile reads from a separate query on `delivery_agent_ratings` keyed by `delivery_agents.id`. We need to confirm both reflect correctly.

### Fix (single migration)

1. **Backfill** existing `delivery_agents.average_rating` and reviews from `delivery_agent_ratings`:
   ```sql
   UPDATE delivery_agents da
   SET average_rating = COALESCE(sub.avg_rating, 0)
   FROM (
     SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
     FROM delivery_agent_ratings
     GROUP BY agent_id
   ) sub
   WHERE da.id = sub.agent_id;
   ```

2. **Create the missing trigger** so future inserts/updates/deletes auto-sync the average:
   ```sql
   DROP TRIGGER IF EXISTS trg_update_delivery_agent_rating_stats ON delivery_agent_ratings;
   CREATE TRIGGER trg_update_delivery_agent_rating_stats
   AFTER INSERT OR UPDATE OR DELETE ON delivery_agent_ratings
   FOR EACH ROW
   EXECUTE FUNCTION update_delivery_agent_rating_stats();
   ```

### Result
- Dileep's profile will immediately show **5.0** rating (2 reviews).
- All future ratings auto-update the agent's average via the trigger.
- No frontend code changes needed — the Profile already reads `average_rating` correctly.

### Notes
- Per memory rule "Trigger Consolidation", we use a single unified trigger for ratings updates.
- This aligns with memory "Ratings Stats — Centralized DB trigger calculates agent ratings" — restoring intended behavior.