-- Fix earnings table constraint issue and add missing columns
ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_status_check;

-- Add proper constraint for earnings status
ALTER TABLE earnings ADD CONSTRAINT earnings_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Ensure distance_traveled is saved during delivery completion
-- Update complete-delivery and qr-complete-delivery edge functions to save proper distance