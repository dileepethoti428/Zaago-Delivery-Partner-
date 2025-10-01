-- Clean up stale packed orders (older than 7 days with no agent)
-- This prevents old test/abandoned orders from triggering notifications

UPDATE orders 
SET 
  status = 'cancelled',
  updated_at = now()
WHERE 
  status = 'packed' 
  AND agent_id IS NULL 
  AND updated_at < now() - interval '7 days';

-- Create an index for better query performance on packed orders
CREATE INDEX IF NOT EXISTS idx_orders_packed_agent_updated 
ON orders(status, agent_id, updated_at) 
WHERE status = 'packed' AND agent_id IS NULL;

-- Add a comment to document the cleanup
COMMENT ON INDEX idx_orders_packed_agent_updated IS 
'Optimizes queries for fresh packed orders without agent assignment. Used by polling fallback and real-time notifications.';