-- Create a simple delivery completion function that avoids JSON parsing issues
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
  -- Simple update without complex JSON operations
  UPDATE public.orders 
  SET 
    status = p_new_status,
    payment_status = p_new_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id 
    AND agent_id = p_agent_id;
    
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or agent not authorized';
  END IF;
END;
$function$;