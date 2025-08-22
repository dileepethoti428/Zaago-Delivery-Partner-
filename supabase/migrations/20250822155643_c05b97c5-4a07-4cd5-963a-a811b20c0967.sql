-- Drop existing constraint to fix the issue
ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_status_check;

-- Fix any invalid status values in existing data 
UPDATE earnings SET status = 'completed' WHERE status = 'confirmed';
UPDATE earnings SET status = 'completed' WHERE status NOT IN ('pending', 'completed', 'failed', 'cancelled');