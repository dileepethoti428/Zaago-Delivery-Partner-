-- Create a completely trigger-free delivery completion function
CREATE OR REPLACE FUNCTION public.complete_delivery_trigger_free(
  p_order_id uuid,
  p_agent_id uuid,  
  p_payment_method text DEFAULT 'Online'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order_status text;
  current_agent_id uuid;
  payment_status_value text;
  rows_updated integer;
BEGIN
  -- Get current order details with no triggers
  SELECT status, agent_id INTO current_order_status, current_agent_id
  FROM orders 
  WHERE id = p_order_id;
  
  -- Check if order exists
  IF current_order_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check if order is already delivered
  IF current_order_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered'
    );
  END IF;
  
  -- Check if order can be completed
  IF current_order_status NOT IN ('assigned', 'packed', 'out_for_delivery') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order cannot be completed from status: ' || current_order_status
    );
  END IF;
  
  -- Verify agent ownership
  IF current_agent_id != p_agent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not assigned to this agent'
    );
  END IF;
  
  -- Set payment status
  payment_status_value := CASE 
    WHEN p_payment_method = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;
  
  -- Disable triggers temporarily and perform raw update
  SET session_replication_role = replica;
  
  -- Direct update with NO trigger execution
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = now(),
    payment_status = payment_status_value,
    updated_at = now()
  WHERE id = p_order_id 
    AND agent_id = p_agent_id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
  
  -- Check if update was successful
  IF rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to update order - security check failed'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payment_status', payment_status_value
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Make sure to re-enable triggers even on error
  SET session_replication_role = DEFAULT;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error: ' || SQLERRM
  );
END;
$$;