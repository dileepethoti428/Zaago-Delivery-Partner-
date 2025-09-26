-- Create service role bypass policy for delivery_agents table
-- This allows edge functions to read agent data for validation
-- without requiring user authentication context

CREATE POLICY "service_role_can_read_agents" 
ON public.delivery_agents 
FOR SELECT 
USING (auth.role() = 'service_role');