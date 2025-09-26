-- Create service role bypass policy for delivery completion
-- This allows the edge function service role to update orders for delivery completion
-- without requiring user authentication context

CREATE POLICY "service_role_can_complete_deliveries" 
ON public.orders 
FOR UPDATE 
USING (
  -- Allow service role to complete deliveries
  auth.role() = 'service_role'
  AND status IN ('assigned', 'picked_up', 'in_transit')
) 
WITH CHECK (
  -- Only allow updating to delivered status with specific fields
  auth.role() = 'service_role'
  AND status = 'delivered'
);