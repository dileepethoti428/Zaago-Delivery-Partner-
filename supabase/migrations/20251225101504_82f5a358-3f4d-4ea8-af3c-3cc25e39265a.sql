-- Fix RLS policies for delivery agents to access data correctly
-- The issue: policies were using JOIN on delivery_agents.id but assigned_agent_id stores auth.uid() directly

-- Drop and recreate customers policy
DROP POLICY IF EXISTS "Delivery agents can view customers for assigned daily orders" ON customers;
CREATE POLICY "Delivery agents can view customers for assigned daily orders" 
ON customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    WHERE d.customer_id = customers.id 
    AND d.assigned_agent_id = auth.uid()
  )
);

-- Drop and recreate subscriptions policy
DROP POLICY IF EXISTS "Delivery agents can view subscriptions for assigned daily order" ON subscriptions;
CREATE POLICY "Delivery agents can view subscriptions for assigned daily orders"
ON subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    WHERE d.subscription_id = subscriptions.id 
    AND d.assigned_agent_id = auth.uid()
  )
);

-- Drop and recreate sellers policy
DROP POLICY IF EXISTS "Delivery agents can view sellers for assigned daily orders" ON sellers;
CREATE POLICY "Delivery agents can view sellers for assigned daily orders"
ON sellers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    JOIN subscriptions s ON s.id = d.subscription_id
    JOIN products p ON p.id = s.product_id
    WHERE p.seller_id = sellers.user_id 
    AND d.assigned_agent_id = auth.uid()
  )
);