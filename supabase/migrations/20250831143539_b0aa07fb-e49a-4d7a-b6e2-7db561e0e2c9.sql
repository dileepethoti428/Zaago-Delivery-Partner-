-- Align orders visibility policy with acceptance flow
DROP POLICY IF EXISTS "Delivery agents can view available orders" ON orders;

CREATE POLICY "Delivery agents can view available orders"
ON orders
FOR SELECT
USING (
  -- Agents can see their own assigned orders
  (agent_id IN (
    SELECT da.id FROM delivery_agents da
    WHERE ((da.email = auth.email()) OR (da.agent_id = (auth.uid())::text)) AND da.is_active = true
  ))
  OR
  -- Or see unassigned 'packed' orders
  ((status = 'packed') AND agent_id IS NULL)
  OR
  -- Admins can see everything
  is_current_user_admin_v2()
);