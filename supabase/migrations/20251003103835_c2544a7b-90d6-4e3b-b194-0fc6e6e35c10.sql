-- Drop ALL versions of the old function completely
DROP FUNCTION IF EXISTS qr_complete_delivery_atomic(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS qr_complete_delivery_atomic(uuid, uuid, text, jsonb, jsonb, numeric) CASCADE;

-- Create new function with DIFFERENT NAME to avoid any ambiguity
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
  v_result JSONB;
BEGIN
  -- Get current order state with row lock
  SELECT * INTO v_order 
  FROM orders 
  WHERE id = p_order_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- If already delivered, return success (idempotent)
  IF v_order.status = 'delivered' THEN
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
  
  -- Update order to delivered
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE 
      WHEN p_payment_method = 'COD' THEN 'pending'
      ELSE 'paid'
    END,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payment_method', p_payment_method,
    'delivered_at', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Handle duplicate completion gracefully
  IF SQLERRM LIKE '%unique_order_delivery%' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered (idempotent)',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error during delivery completion',
    'details', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION qr_complete_delivery_v2 IS 'Atomically completes QR delivery with idempotency - v2 to avoid function overloading ambiguity';