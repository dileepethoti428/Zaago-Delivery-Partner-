-- Create a safe delivery completion function that bypasses problematic triggers
CREATE OR REPLACE FUNCTION public.complete_delivery_safe(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payment_status TEXT;
  v_result JSONB;
BEGIN
  -- Get and validate order
  SELECT * INTO v_order
  FROM orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get and validate agent
  SELECT * INTO v_agent
  FROM delivery_agents 
  WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found'
    );
  END IF;
  
  -- Check if already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order already delivered'
    );
  END IF;
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;
  
  -- Perform the critical update using direct SQL to minimize trigger issues
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id
    AND status != 'delivered'; -- Prevent duplicate updates
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to update order - may already be delivered'
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'status', 'delivered',
    'payment_status', v_payment_status,
    'delivered_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return failure
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata,
      error
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'delivery_completion_failed',
        'order_id', p_order_id,
        'agent_id', p_agent_id,
        'payment_method', p_payment_method,
        'error_time', NOW()
      ),
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database error occurred',
      'details', SQLERRM
    );
END;
$$;