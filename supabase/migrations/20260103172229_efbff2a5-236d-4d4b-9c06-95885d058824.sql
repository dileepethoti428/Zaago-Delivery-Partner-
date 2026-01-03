-- Fix all existing broken orders: sync agent_id → assigned_agent_id
UPDATE orders 
SET assigned_agent_id = agent_id 
WHERE agent_id IS NOT NULL 
  AND assigned_agent_id IS NULL;