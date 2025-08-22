-- Add delivery_payout and agent_location columns to delivery_history table if they don't exist
ALTER TABLE delivery_history ADD COLUMN IF NOT EXISTS delivery_payout NUMERIC DEFAULT 0;
ALTER TABLE delivery_history ADD COLUMN IF NOT EXISTS agent_location JSONB DEFAULT NULL;

-- Add distance_km, payment_method, and description columns to earnings table if they don't exist  
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Online';
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;