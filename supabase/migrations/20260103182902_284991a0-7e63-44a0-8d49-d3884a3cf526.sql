-- Drop and recreate complete_delivery_zepto(uuid, uuid, text) with proper UUID handling
-- Fixes: operator does not exist: uuid = text

DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout NUMERIC;
  v_distance NUMERIC;
  v_normalized_payment TEXT;
  v_existing RECORD;
BEGIN
  -- Input validation
  IF p_order_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order ID is required');
  END IF;
  
  IF p_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Agent ID is required');
  END IF;

  -- Check for idempotency (already completed) - use UUID comparison directly
  SELECT id, delivery_payout, distance_traveled 
  INTO v_existing
  FROM delivery_history 
  WHERE order_id = p_order_id 
    AND agent_id = p_agent_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'already_completed', true,
      'payout', COALESCE(v_existing.delivery_payout, 0),
      'distance_km', COALESCE(v_existing.distance_traveled, 0)
    );
  END IF;

  -- Fetch order details
  SELECT id, user_id, total, address, status, assigned_agent_id
  INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Fetch agent details
  SELECT id, name, phone
  INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Normalize payment method
  v_normalized_payment := LOWER(TRIM(COALESCE(p_payment_method, 'cod')));
  IF v_normalized_payment IN ('cash', 'cash_on_delivery') THEN
    v_normalized_payment := 'cod';
  ELSIF v_normalized_payment IN ('online', 'upi', 'card', 'prepaid') THEN
    v_normalized_payment := 'online';
  END IF;

  -- Calculate distance (default 2km if not available)
  v_distance := 2.0;

  -- Calculate payout: ₹10 base + ₹8/km (Zepto-style)
  v_payout := 10 + (v_distance * 8);

  -- Update order status
  UPDATE orders
  SET status = 'delivered',
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert delivery history record - using UUID directly, no ::text casts
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
    delivery_payout,
    distance_traveled,
    delivery_date,
    completed_at
  ) VALUES (
    p_order_id,  -- UUID directly
    p_agent_id,  -- UUID directly
    COALESCE((v_order.address->>'user_name')::TEXT, 'Customer'),
    COALESCE((v_order.address->>'phone')::TEXT, ''),
    COALESCE(v_order.address, '{}'::JSONB),
    '[]'::JSONB,
    COALESCE(v_order.total, 0),
    v_normalized_payment,
    'completed',
    v_payout,
    v_distance,
    CURRENT_DATE,
    NOW()
  );

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_payout,
      last_delivery_at = NOW(),
      deliveries_today = COALESCE(deliveries_today, 0) + 1,
      updated_at = NOW()
  WHERE id = p_agent_id;

  RETURN json_build_object(
    'success', true,
    'payout', v_payout,
    'distance_km', v_distance,
    'payment_method', v_normalized_payment
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;