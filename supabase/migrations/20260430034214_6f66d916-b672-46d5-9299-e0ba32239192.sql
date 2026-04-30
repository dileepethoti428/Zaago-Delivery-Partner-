-- Backfill average_rating from existing ratings
UPDATE delivery_agents da
SET average_rating = COALESCE(sub.avg_rating, 0)
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE da.id = sub.agent_id;

-- Create the missing trigger to keep average_rating in sync going forward
DROP TRIGGER IF EXISTS trg_update_delivery_agent_rating_stats ON delivery_agent_ratings;
CREATE TRIGGER trg_update_delivery_agent_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON delivery_agent_ratings
FOR EACH ROW
EXECUTE FUNCTION update_delivery_agent_rating_stats();