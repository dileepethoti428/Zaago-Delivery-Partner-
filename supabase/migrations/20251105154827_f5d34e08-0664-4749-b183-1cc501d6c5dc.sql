-- Allow users to create their own agent profile during registration
CREATE POLICY "Users can create their own agent profile"
ON public.delivery_agents
FOR INSERT
TO authenticated
WITH CHECK (
  agent_id = auth.uid()::text
);