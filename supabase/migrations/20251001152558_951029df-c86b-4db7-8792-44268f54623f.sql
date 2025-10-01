-- Add push_subscription column to delivery_agents table for Web Push notifications
ALTER TABLE delivery_agents 
ADD COLUMN IF NOT EXISTS push_subscription JSONB DEFAULT NULL;

-- Add index for faster lookups of agents with push subscriptions
CREATE INDEX IF NOT EXISTS idx_delivery_agents_push_subscription 
ON delivery_agents (id) 
WHERE push_subscription IS NOT NULL;

-- Add comment
COMMENT ON COLUMN delivery_agents.push_subscription IS 'Web Push subscription object for sending background notifications to agents';