CREATE POLICY "Agents can view their own ratings"
ON public.delivery_agent_ratings
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.delivery_agents WHERE agent_id = auth.uid()
  )
);