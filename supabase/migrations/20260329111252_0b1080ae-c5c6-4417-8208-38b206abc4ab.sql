-- Add tip_amount to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;

-- Add tip_amount to delivery_history table  
ALTER TABLE delivery_history ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;

-- Add tip_amount to agent_earnings_tracking table
ALTER TABLE agent_earnings_tracking ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;