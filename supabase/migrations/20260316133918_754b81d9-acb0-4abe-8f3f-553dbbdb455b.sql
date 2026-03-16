-- Step 1: Drop the old duplicate trigger (keep only update_agent_rating_after_insert)
DROP TRIGGER IF EXISTS trigger_update_delivery_agent_rating_stats ON public.delivery_agent_ratings;

-- Step 2: Re-sync average_rating for all agents based on current actual ratings
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