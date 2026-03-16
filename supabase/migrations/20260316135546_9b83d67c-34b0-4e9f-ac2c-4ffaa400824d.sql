
-- Step 1: Recreate the trigger on delivery_agent_ratings
-- The previous migration dropped both triggers but the replacement was never created
CREATE OR REPLACE TRIGGER update_agent_rating_on_change
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_agent_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_delivery_agent_rating_stats();

-- Step 2: Re-sync all agent averages to current actual values
UPDATE public.delivery_agents d
SET 
  average_rating = COALESCE(sub.avg_rating, 0),
  updated_at = now()
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM public.delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE d.id = sub.agent_id;
