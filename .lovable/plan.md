## Fix: Profile Rating not updating while Reviews count updates

### Root cause found
The Profile UI is not the main problem. It reads:
- `Reviews` directly from `delivery_agent_ratings` count, so it updates immediately.
- `Rating` from `delivery_agents.average_rating`, so it only updates if the database sync trigger updates that column.

Database inspection shows the real issue:
- There is currently **no trigger attached** to `delivery_agent_ratings`.
- The earlier trigger migration file exists in the repo, but the live database does not have the trigger, so new reviews are counted but do not recalculate `delivery_agents.average_rating`.
- Current data is already stale:
  - Dileep: 3 reviews averaging **3.7**, but stored `average_rating` is still **5.00**.
  - Dinesh: 1 review averaging **5.0**, but stored `average_rating` is **0.00**.

### Fix
1. Apply a database migration that safely recreates the trigger:
   ```sql
   DROP TRIGGER IF EXISTS trg_update_delivery_agent_rating_stats ON public.delivery_agent_ratings;

   CREATE TRIGGER trg_update_delivery_agent_rating_stats
   AFTER INSERT OR UPDATE OR DELETE ON public.delivery_agent_ratings
   FOR EACH ROW
   EXECUTE FUNCTION public.update_delivery_agent_rating_stats();
   ```

2. Backfill all existing agent ratings so stored `delivery_agents.average_rating` matches actual review data:
   ```sql
   UPDATE public.delivery_agents da
   SET
     average_rating = COALESCE(rs.avg_rating, 0),
     updated_at = now()
   FROM (
     SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
     FROM public.delivery_agent_ratings
     GROUP BY agent_id
   ) rs
   WHERE da.id = rs.agent_id;
   ```

3. Also reset agents with no reviews back to `0` so old stale values cannot remain:
   ```sql
   UPDATE public.delivery_agents da
   SET average_rating = 0, updated_at = now()
   WHERE NOT EXISTS (
     SELECT 1
     FROM public.delivery_agent_ratings r
     WHERE r.agent_id = da.id
   );
   ```

4. Verify after migration:
   - `information_schema.triggers` contains `trg_update_delivery_agent_rating_stats`.
   - `delivery_agents.average_rating` equals `ROUND(AVG(delivery_agent_ratings.rating), 1)` for every reviewed agent.

### Optional frontend hardening
To prevent this kind of mismatch from being visible even if the stored aggregate becomes stale again, update `fetchAgentProfileById()` to calculate `average_rating` from `delivery_agent_ratings` together with `review_count`, and return that computed value to Profile.

This makes the Profile display source-of-truth review data directly, while the database trigger still keeps the aggregate column correct for other screens.

### Expected result
- Rating and Reviews will stay consistent on the Profile page.
- Dileep should show rating **3.7** with **3** reviews based on the current live data.
- Dinesh should show rating **5.0** with **1** review.
- Future inserted/updated/deleted reviews will automatically update the stored rating.