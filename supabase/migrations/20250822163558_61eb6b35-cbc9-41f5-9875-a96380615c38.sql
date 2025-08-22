-- Allow delivery agents to view unassigned orders for pickup
CREATE POLICY "Delivery agents can view available orders" 
ON public.orders 
FOR SELECT 
USING (
  -- Agents can see orders that are either:
  -- 1. Assigned to them specifically
  (agent_id IN (
    SELECT id FROM delivery_agents 
    WHERE email = auth.email() AND is_active = true
  ))
  OR
  -- 2. Available orders (placed status with no agent assigned yet)
  (status = 'placed' AND agent_id IS NULL)
  OR
  -- 3. Admins can see all orders
  is_current_user_admin_v2()
);