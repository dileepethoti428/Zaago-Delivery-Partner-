-- Create function to update order status for delivery completion
CREATE OR REPLACE FUNCTION update_order_status(
  order_id UUID,
  new_status TEXT,
  new_payment_status TEXT,
  agent_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the order with delivered status
  UPDATE public.orders 
  SET 
    status = new_status,
    delivered_at = NOW(),
    payment_status = new_payment_status,
    updated_at = NOW()
  WHERE id = order_id
    AND agent_id = update_order_status.agent_id;
    
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or agent not authorized';
  END IF;
END;
$$;