-- Remove the problematic foreign key constraint
-- This allows orders.agent_id (UUID) and delivery_agents.agent_id (TEXT) to coexist
-- The app will handle the type casting in the edge functions
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_agent_id_fkey;