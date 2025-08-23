-- Fix the update_order_status function with correct WHERE clause
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_new_payment_status TEXT,
  p_agent_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the order with delivered status
  UPDATE public.orders 
  SET 
    status = p_new_status,
    delivered_at = NOW(),
    payment_status = p_new_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id
    AND agent_id = p_agent_id;
    
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or agent not authorized';
  END IF;
END;
$$;