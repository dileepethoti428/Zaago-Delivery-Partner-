-- Fix the RLS policy for agents accepting orders
-- The issue is in the with_check condition that incorrectly matches auth.uid() with agent_id field

DROP POLICY IF EXISTS "Agents can accept unassigned orders" ON orders;

CREATE POLICY "Agents can accept unassigned orders"
ON orders
FOR UPDATE
USING (
  status = 'packed' AND agent_id IS NULL
)
WITH CHECK (
  agent_id IN (
    SELECT da.id
    FROM delivery_agents da
    WHERE da.email = auth.email() AND da.is_active = true
  )
);