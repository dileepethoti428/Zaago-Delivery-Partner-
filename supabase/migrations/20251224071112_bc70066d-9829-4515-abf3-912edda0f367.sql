-- Add RLS policy for delivery agents to SELECT subscriptions for assigned daily orders
CREATE POLICY "Delivery agents can view subscriptions for assigned daily orders"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    JOIN delivery_agents da ON da.id = d.assigned_agent_id
    WHERE d.subscription_id = subscriptions.id
    AND da.agent_id = auth.uid()
  )
);

-- Add RLS policy for delivery agents to SELECT customers for assigned daily orders
CREATE POLICY "Delivery agents can view customers for assigned daily orders"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    JOIN delivery_agents da ON da.id = d.assigned_agent_id
    WHERE d.customer_id = customers.id
    AND da.agent_id = auth.uid()
  )
);

-- Add RLS policy for delivery agents to SELECT sellers for assigned daily orders
CREATE POLICY "Delivery agents can view sellers for assigned daily orders"
ON public.sellers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_orders d
    JOIN delivery_agents da ON da.id = d.assigned_agent_id
    JOIN subscriptions s ON s.id = d.subscription_id
    JOIN products p ON p.id = s.product_id
    WHERE p.seller_id = sellers.user_id
    AND da.agent_id = auth.uid()
  )
);