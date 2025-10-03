-- Add unique constraint to earnings table to prevent duplicate records
-- This fixes the "no unique or exclusion constraint matching the ON CONFLICT specification" error

ALTER TABLE earnings 
ADD CONSTRAINT unique_agent_order_earning 
UNIQUE (agent_id, order_id);

-- Log the constraint creation
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'unique_constraint_added',
    'table', 'earnings',
    'constraint_name', 'unique_agent_order_earning',
    'columns', ARRAY['agent_id', 'order_id'],
    'created_at', now(),
    'note', 'Prevents duplicate earnings records and fixes ON CONFLICT clause'
  )
);