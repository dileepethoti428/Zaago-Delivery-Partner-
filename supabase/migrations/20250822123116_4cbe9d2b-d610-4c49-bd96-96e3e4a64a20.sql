-- Fix earnings table and create earnings from delivery history
-- First let's ensure we have proper indexes and constraints
CREATE INDEX IF NOT EXISTS idx_earnings_order_id ON earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_agent_id ON earnings(agent_id);

-- Create earnings entries for existing delivery history (with proper duplicate handling)
INSERT INTO earnings (agent_id, order_id, amount, status)
SELECT 
  dh.agent_id,
  dh.order_id,
  ROUND(dh.total_amount * 0.15, 2) as amount, -- 15% commission for delivery agent
  'confirmed' as status
FROM delivery_history dh
WHERE dh.agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM earnings e 
    WHERE e.order_id = dh.order_id AND e.agent_id = dh.agent_id
  );