-- Fix duplicate delivery handling in manual_complete_delivery and simple_mark_delivered functions

-- 1. Update manual_complete_delivery to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_distance_km NUMERIC := 5;
  v_payout_amount NUMERIC := 30;
  v_normalized_payment TEXT;
  v_rows_inserted INTEGER;
BEGIN
  -- Fetch order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Check if order already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'message', 'Order already delivered'
    );
  END IF;

  -- NEW: Check if delivery_history record already exists
  IF EXISTS(
    SELECT 1 FROM delivery_history 
    WHERE order_id = p_order_id AND agent_id = p_agent_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'message', 'Delivery already recorded'
    );
  END IF;

  -- Resolve customer name and phone
  v_customer_name := COALESCE(v_order.customer_name, 'Unknown Customer');
  v_customer_phone := COALESCE(v_order.customer_phone, 'N/A');

  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Insert delivery history with conflict handling
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    payment_method,
    payment_status,
    delivery_date,
    completed_at,
    delivery_payout,
    distance_traveled
  )
  VALUES (
    p_order_id,
    p_agent_id,
    v_customer_name,
    v_customer_phone,
    v_order.delivery_address,
    v_order.items,
    v_order.total_amount,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    CURRENT_DATE,
    NOW(),
    v_payout_amount,
    v_distance_km
  )
  ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;

  -- Check if insert succeeded
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  
  IF v_rows_inserted = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout_amount,
      'message', 'Delivery already recorded (conflict)'
    );
  END IF;

  -- Update order status to delivered
  UPDATE orders
  SET 
    status = 'delivered',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET 
    payout_status = 'confirmed',
    actual_payout = v_payout_amount,
    completed_at = NOW(),
    payment_method = v_normalized_payment,
    distance_km = v_distance_km,
    updated_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km,
    'payment_method', v_normalized_payment
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 2. Update simple_mark_delivered to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_distance_km NUMERIC := 5;
  v_payout_amount NUMERIC := 30;
  v_normalized_payment TEXT;
  v_rows_inserted INTEGER;
BEGIN
  -- Fetch order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Check if order already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'message', 'Order already delivered'
    );
  END IF;

  -- NEW: Check if delivery_history record already exists
  IF EXISTS(
    SELECT 1 FROM delivery_history 
    WHERE order_id = p_order_id AND agent_id = p_agent_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'message', 'Delivery already recorded'
    );
  END IF;

  -- Resolve customer name and phone
  v_customer_name := COALESCE(v_order.customer_name, 'Unknown Customer');
  v_customer_phone := COALESCE(v_order.customer_phone, 'N/A');

  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Insert delivery history with conflict handling
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    payment_method,
    payment_status,
    delivery_date,
    completed_at,
    delivery_payout,
    distance_traveled
  )
  VALUES (
    p_order_id,
    p_agent_id,
    v_customer_name,
    v_customer_phone,
    v_order.delivery_address,
    v_order.items,
    v_order.total_amount,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    CURRENT_DATE,
    NOW(),
    v_payout_amount,
    v_distance_km
  )
  ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;

  -- Check if insert succeeded
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  
  IF v_rows_inserted = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout_amount,
      'message', 'Delivery already recorded (conflict)'
    );
  END IF;

  -- Update order status to delivered
  UPDATE orders
  SET 
    status = 'delivered',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET 
    payout_status = 'confirmed',
    actual_payout = v_payout_amount,
    completed_at = NOW(),
    payment_method = v_normalized_payment,
    distance_km = v_distance_km,
    updated_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km,
    'payment_method', v_normalized_payment
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;