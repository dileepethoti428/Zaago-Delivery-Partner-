-- Create an ultra-simple delivery completion function that avoids all transaction issues
CREATE OR REPLACE FUNCTION public.ultra_simple_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Single, simple update with minimal validation
  UPDATE public.orders 
  SET 
    status = 'delivered',
    payment_status = p_payment_status,
    delivered_at = now(),
    updated_at = now()
  WHERE id = p_order_id 
    AND agent_id = p_agent_id
    AND status != 'delivered';
    
  -- Check if update was successful
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery completed');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or already delivered');
  END IF;
END;
$$;