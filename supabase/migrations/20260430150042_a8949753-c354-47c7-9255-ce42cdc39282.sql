-- Recreate trigger to auto-sync delivery_agents.average_rating from delivery_agent_ratings
DROP TRIGGER IF EXISTS trg_update_delivery_agent_rating_stats ON public.delivery_agent_ratings;

CREATE TRIGGER trg_update_delivery_agent_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_agent_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_delivery_agent_rating_stats();

-- Backfill stored average_rating from real ratings
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

-- Reset agents with no reviews to 0 to clear any stale value
UPDATE public.delivery_agents da
SET average_rating = 0, updated_at = now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_agent_ratings r WHERE r.agent_id = da.id
)
AND COALESCE(da.average_rating, 0) <> 0;