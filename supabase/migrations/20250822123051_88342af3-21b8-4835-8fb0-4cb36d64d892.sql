-- Create earnings entries for existing delivery history
INSERT INTO earnings (agent_id, order_id, amount, status)
SELECT 
  agent_id,
  order_id,
  total_amount * 0.15 as amount, -- 15% commission for delivery agent
  'confirmed' as status
FROM delivery_history 
WHERE agent_id IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;