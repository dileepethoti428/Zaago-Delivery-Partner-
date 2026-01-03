-- Drop and recreate the CORRECT overload that the Edge Function actually calls
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
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
  v_agent RECORD;
  v_existing_history RECORD;
  v_distance_km numeric;
  v_base_pay numeric := 10;
  v_rate_per_km numeric := 8;
  v_distance_pay numeric;
  v_payout numeric;
  v_cod_amount numeric := 0;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := UPPER(COALESCE(p_payment_method, 'ONLINE'));
  IF v_normalized_payment NOT IN ('COD', 'ONLINE', 'PREPAID', 'UPI') THEN
    v_normalized_payment := 'ONLINE';
  END IF;

  -- Idempotency: Check if already completed
  SELECT * INTO v_existing_history
  FROM delivery_history
  WHERE order_id = p_order_id::text
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', COALESCE(v_existing_history.delivery_payout, 0),
      'distance_km', COALESCE(v_existing_history.distance_traveled, 0),
      'cod_amount', CASE WHEN v_existing_history.payment_method = 'COD' THEN v_existing_history.total_amount ELSE 0 END,
      'payment_method', v_existing_history.payment_method
    );
  END IF;

  -- Fetch order (using correct column names: total, address)
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Fetch agent
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Calculate distance (use order's distance_km or default to 1)
  v_distance_km := COALESCE(v_order.distance_km, 1);

  -- Zepto-style payout: base + (distance * rate), round distance to 1 decimal
  v_distance_km := ROUND(v_distance_km::numeric, 1);
  v_distance_pay := v_distance_km * v_rate_per_km;
  v_payout := v_base_pay + v_distance_pay;

  -- COD amount (use orders.total, not total_amount)
  IF v_normalized_payment = 'COD' THEN
    v_cod_amount := COALESCE(v_order.total, 0);
  END IF;

  -- Update order status (only columns that exist: status, updated_at, delivered_at)
  UPDATE orders
  SET 
    status = 'delivered',
    updated_at = NOW(),
    delivered_at = NOW()
  WHERE id = p_order_id;

  -- Insert delivery history (use orders.address, not delivery_address)
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
    completed_at,
    delivery_date
  ) VALUES (
    p_order_id::text,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'COD' THEN 'pending' ELSE 'paid' END,
    v_payout,
    v_distance_km,
    NOW(),
    CURRENT_DATE
  );

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Insert earnings record
  INSERT INTO earnings (
    agent_id,
    order_id,
    amount,
    distance_km,
    payment_method,
    status,
    description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout,
    v_distance_km,
    v_normalized_payment,
    'completed',
    'Delivery payout: ₹' || v_base_pay || ' base + ₹' || v_distance_pay || ' (' || v_distance_km || ' km)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout,
    'distance_km', v_distance_km,
    'payout_breakdown', jsonb_build_object(
      'base_pay', v_base_pay,
      'distance_pay', v_distance_pay,
      'rate_per_km', v_rate_per_km
    ),
    'cod_amount', v_cod_amount,
    'payment_method', v_normalized_payment
  );
END;
$$;