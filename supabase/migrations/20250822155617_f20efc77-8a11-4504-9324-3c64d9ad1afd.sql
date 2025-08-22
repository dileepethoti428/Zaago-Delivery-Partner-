-- First update any invalid status values in existing data
UPDATE earnings SET status = 'completed' WHERE status NOT IN ('pending', 'completed', 'failed', 'cancelled');

-- Now add the constraint
ALTER TABLE earnings ADD CONSTRAINT earnings_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));