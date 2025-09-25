-- Create a simplified delivery completion procedure that bypasses triggers
CREATE OR REPLACE FUNCTION public.simple_complete_delivery(
  p_order_id uuid, 
  p_new_status text, 
  p_new_payment_status text, 
  p_agent_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Simple update with minimal fields to avoid JSON parsing issues
  UPDATE public.orders 
  SET 
    status = p_new_status,
    delivered_at = CURRENT_TIMESTAMP,
    payment_status = p_new_payment_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id
    AND agent_id = p_agent_id;
    
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or agent not authorized for order %', p_order_id;
  END IF;
END;
$function$;