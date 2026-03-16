-- Step 1: Create the missing trigger on delivery_agent_ratings
CREATE OR REPLACE TRIGGER update_agent_rating_after_insert
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_agent_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_delivery_agent_rating_stats();

-- Step 2: Backfill existing ratings into delivery_agents.average_rating
UPDATE public.delivery_agents d
SET average_rating = sub.avg_rating, updated_at = now()
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM public.delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE d.id = sub.agent_id;