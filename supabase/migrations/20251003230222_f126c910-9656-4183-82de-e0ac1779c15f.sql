-- Drop and recreate qr_complete_delivery_v3 with correct payment_status mapping
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(uuid, uuid, text, numeric, jsonb, jsonb);

CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT,
  p_distance_km NUMERIC DEFAULT 0,
  p_agent_location JSONB DEFAULT NULL,
  p_customer_location JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_normalized_payment TEXT;
  v_payment_status TEXT;
  v_payout_result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH_ON_DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'DIGITAL') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  -- Map to valid payment_status values
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'COD' THEN 'paid_cod'
    WHEN v_normalized_payment = 'ONLINE' THEN 'paid_online'
    ELSE 'pending'
  END;
  
  -- Update order
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_method = v_normalized_payment,
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id
    AND agent_id = p_agent_id;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or agent mismatch');
  END IF;
  
  -- Process delivery payout
  SELECT process_delivery_payout_safe(
    p_agent_id,
    p_order_id,
    p_distance_km,
    NOW()
  ) INTO v_payout_result;
  
  -- Create delivery completion record
  INSERT INTO delivery_completions (
    order_id,
    agent_id,
    completed_at,
    customer_location,
    agent_location,
    distance_km,
    payout_amount,
    payment_method,
    status,
    metadata
  ) VALUES (
    p_order_id,
    p_agent_id,
    NOW(),
    p_customer_location,
    p_agent_location,
    p_distance_km,
    COALESCE((v_payout_result->>'total_payout')::NUMERIC, 0),
    v_normalized_payment,
    'completed',
    jsonb_build_object(
      'delivery_completed_at', NOW(),
      'payout_processed', v_payout_result->>'success'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payment_method', v_normalized_payment,
    'payment_status', v_payment_status,
    'payout_details', v_payout_result
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;