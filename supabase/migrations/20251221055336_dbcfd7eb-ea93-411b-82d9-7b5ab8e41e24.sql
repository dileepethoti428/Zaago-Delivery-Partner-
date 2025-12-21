-- Phase 1: Database Schema Changes for Country Delight-style Agent Consistency

-- 1. Add last_location_updated_at to delivery_agents
ALTER TABLE delivery_agents
ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMPTZ;

-- 2. Add primary_agent_id and last_assigned_agent_id to subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS primary_agent_id UUID REFERENCES delivery_agents(id),
ADD COLUMN IF NOT EXISTS last_assigned_agent_id UUID REFERENCES delivery_agents(id);

-- 3. Add assignment_type to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('primary', 'fallback', 'manual'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_primary_agent ON subscriptions(primary_agent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_assigned_agent ON subscriptions(last_assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_assignment_type ON orders(assignment_type);
CREATE INDEX IF NOT EXISTS idx_delivery_agents_last_location ON delivery_agents(last_location_updated_at);