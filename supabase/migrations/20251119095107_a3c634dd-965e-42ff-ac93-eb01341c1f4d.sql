-- Phase 2: Clean up old orders in database
-- Cancel orders that are assigned but haven't been updated in 48+ hours

UPDATE orders 
SET status = 'cancelled', 
    updated_at = NOW()
WHERE status IN ('assigned', 'picked_up') 
  AND updated_at < NOW() - INTERVAL '48 hours'
  AND id NOT IN (
    SELECT order_id FROM delivery_completions 
    WHERE status = 'completed'
  );