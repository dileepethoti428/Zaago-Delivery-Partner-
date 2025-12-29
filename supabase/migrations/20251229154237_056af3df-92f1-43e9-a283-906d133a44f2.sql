-- Add order_type column to agent_earnings_tracking for cleaner subscription vs regular order filtering
ALTER TABLE agent_earnings_tracking 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'regular' 
CHECK (order_type IN ('regular', 'subscription'));

-- Add index for faster filtering by order_type
CREATE INDEX IF NOT EXISTS idx_agent_earnings_tracking_order_type 
ON agent_earnings_tracking(order_type);

-- Update existing records to set order_type based on payout_breakdown
UPDATE agent_earnings_tracking
SET order_type = 'subscription'
WHERE payout_breakdown::text LIKE '%"subscription":true%' 
   OR payout_breakdown::text LIKE '%"subscription": true%';