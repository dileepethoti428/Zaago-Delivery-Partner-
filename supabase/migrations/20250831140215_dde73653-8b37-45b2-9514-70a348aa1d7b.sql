-- Fix RLS policy for order acceptance - change from 'placed' to 'packed' status
DROP POLICY IF EXISTS "Agents can accept unassigned orders" ON public.orders;

CREATE POLICY "Agents can accept unassigned orders" 
ON public.orders 
FOR UPDATE 
USING (status = 'packed' AND agent_id IS NULL)
WITH CHECK (
  agent_id IN (
    SELECT da.id
    FROM delivery_agents da
    WHERE ((da.email = auth.email() OR da.agent_id = auth.uid()::text) 
           AND da.is_active = true)
  )
);