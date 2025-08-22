
-- Ensure RLS is on for orders (safe to run even if already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow active delivery agents to accept unassigned orders
-- When updating an order that is currently unassigned and placed,
-- the new row must have agent_id of the current authenticated agent.
CREATE POLICY "Agents can accept unassigned orders"
ON public.orders
FOR UPDATE
USING (
  status = 'placed' AND agent_id IS NULL
)
WITH CHECK (
  agent_id IN (
    SELECT da.id
    FROM public.delivery_agents da
    WHERE (
      da.email = auth.email()
      OR da.agent_id = (auth.uid())::text
    )
    AND da.is_active = true
  )
);

-- Allow active delivery agents to update orders already assigned to them
-- (e.g., subsequent status updates if needed)
CREATE POLICY "Agents can update their assigned orders"
ON public.orders
FOR UPDATE
USING (
  agent_id IN (
    SELECT da.id
    FROM public.delivery_agents da
    WHERE (
      da.email = auth.email()
      OR da.agent_id = (auth.uid())::text
    )
    AND da.is_active = true
  )
)
WITH CHECK (
  agent_id IN (
    SELECT da.id
    FROM public.delivery_agents da
    WHERE (
      da.email = auth.email()
      OR da.agent_id = (auth.uid())::text
    )
    AND da.is_active = true
  )
);
