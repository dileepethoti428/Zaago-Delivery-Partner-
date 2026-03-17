-- Drop the duplicate trigger (keep update_agent_rating_after_insert)
DROP TRIGGER IF EXISTS update_agent_rating_on_change ON public.delivery_agent_ratings;

-- Re-sync ALL agent average ratings to correct values from actual data
UPDATE public.delivery_agents d
SET 
  average_rating = sub.avg_rating,
  updated_at = now()
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM public.delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE d.id = sub.agent_id;