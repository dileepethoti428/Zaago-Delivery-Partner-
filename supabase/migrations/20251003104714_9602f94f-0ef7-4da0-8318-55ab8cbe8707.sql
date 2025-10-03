-- Fix qr_complete_delivery_v2 to actually update orders
DROP FUNCTION IF EXISTS qr_complete_delivery_v2(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION qr_complete_delivery_v2(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_update_count INTEGER;
BEGIN
  -- Get current order state (without locking)
  SELECT * INTO v_order 
  FROM orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- ONLY return "already delivered" if ACTUALLY delivered
  IF v_order.status = 'delivered' AND v_order.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;
  
  -- Verify order is assigned to this agent
  IF v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not assigned to this agent'
    );
  END IF;
  
  -- Verify order is in valid state for completion
  IF v_order.status NOT IN ('assigned', 'packed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order is not in a valid state for completion',
      'current_status', v_order.status
    );
  END IF;
  
  -- Update order to delivered (with delivered = true)
  UPDATE orders
  SET 
    status = 'delivered',
    delivered = true,
    delivered_at = NOW(),
    payment_status = CASE 
      WHEN p_payment_method = 'COD' THEN 'pending'
      ELSE 'paid'
    END,
    updated_at = NOW()
  WHERE id = p_order_id
    AND status IN ('assigned', 'packed');
  
  -- Check if UPDATE actually worked
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  
  IF v_update_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to update order - no rows affected',
      'current_status', v_order.status,
      'order_id', p_order_id
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payment_method', p_payment_method,
    'delivered_at', NOW(),
    'rows_updated', v_update_count
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error during delivery completion',
    'details', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION qr_complete_delivery_v2 IS 'Fixed version that actually updates orders to delivered status with proper verification';