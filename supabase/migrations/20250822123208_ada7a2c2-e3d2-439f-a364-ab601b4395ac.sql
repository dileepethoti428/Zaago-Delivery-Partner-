-- Create earnings only for orders that exist in both tables
-- Fix earnings table constraint and create earnings from delivery history
ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_status_check;
ALTER TABLE earnings ADD CONSTRAINT earnings_status_check 
CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled'));

-- Create earnings entries for existing delivery history where orders still exist
INSERT INTO earnings (agent_id, order_id, amount, status)
SELECT 
  dh.agent_id,
  dh.order_id,
  ROUND(dh.total_amount * 0.15, 2) as amount, -- 15% commission for delivery agent
  'confirmed' as status
FROM delivery_history dh
INNER JOIN orders o ON o.id = dh.order_id  -- Only include orders that exist
WHERE dh.agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM earnings e 
    WHERE e.order_id = dh.order_id AND e.agent_id = dh.agent_id
  );