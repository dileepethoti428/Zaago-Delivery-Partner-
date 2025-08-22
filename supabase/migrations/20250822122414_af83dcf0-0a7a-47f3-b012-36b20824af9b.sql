-- Update the check constraint to allow 'new_order' type
ALTER TABLE agent_notifications DROP CONSTRAINT IF EXISTS agent_notifications_type_check;

-- Add the updated constraint with 'new_order' included
ALTER TABLE agent_notifications ADD CONSTRAINT agent_notifications_type_check 
CHECK (type IN ('status_update', 'payout', 'info', 'order_assigned', 'new_order'));