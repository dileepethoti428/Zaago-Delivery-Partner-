-- Update complete_delivery_zepto to be idempotent (handle duplicate completions gracefully)
CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing_delivery RECORD;
  v_order RECORD;
  v_agent RECORD;
  v_payout_amount NUMERIC := 0;
  v_distance_km NUMERIC := 0;
  v_base_payout NUMERIC := 25;
  v_per_km_rate NUMERIC := 5;
  v_cod_bonus NUMERIC := 0;
  v_peak_bonus NUMERIC := 0;
  v_is_peak_hour BOOLEAN := false;
  v_current_hour INTEGER;
  v_normalized_payment TEXT;
BEGIN
  -- STEP 1: IDEMPOTENCY CHECK - If delivery already completed, return success
  SELECT id, delivery_payout INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id::text AND agent_id = p_agent_id;

  IF v_existing_delivery.id IS NOT NULL THEN
    RAISE NOTICE '⚠️ Delivery already completed for order %, returning success', p_order_id;
    RETURN json_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', COALESCE(v_existing_delivery.delivery_payout, 0),
      'order_id', p_order_id
    );
  END IF;

  -- Normalize payment method
  v_normalized_payment := UPPER(TRIM(COALESCE(p_payment_method, 'COD')));
  IF v_normalized_payment NOT IN ('COD', 'ONLINE', 'PREPAID', 'UPI', 'CARD') THEN
    v_normalized_payment := 'COD';
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF v_agent IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Calculate distance (simplified - use order's distance if available)
  v_distance_km := COALESCE(v_order.distance_km, 2.0);

  -- Check peak hours (7-9 AM, 6-9 PM)
  v_current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata');
  v_is_peak_hour := v_current_hour BETWEEN 7 AND 9 OR v_current_hour BETWEEN 18 AND 21;

  -- Calculate payout
  v_payout_amount := v_base_payout + (v_distance_km * v_per_km_rate);
  
  -- COD bonus (₹5)
  IF v_normalized_payment = 'COD' THEN
    v_cod_bonus := 5;
    v_payout_amount := v_payout_amount + v_cod_bonus;
  END IF;

  -- Peak hour bonus (₹10)
  IF v_is_peak_hour THEN
    v_peak_bonus := 10;
    v_payout_amount := v_payout_amount + v_peak_bonus;
  END IF;

  -- Round payout
  v_payout_amount := ROUND(v_payout_amount, 2);

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_method = v_normalized_payment,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert delivery history
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
    p_order_id::text,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    COALESCE(v_order.delivery_address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total_amount, 0),
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'COD' THEN 'pending' ELSE 'paid' END,
    v_payout_amount,
    v_distance_km,
    CURRENT_DATE,
    NOW()
  );

  -- Insert earnings tracking
  INSERT INTO agent_earnings_tracking (
    agent_id,
    order_id,
    expected_payout,
    actual_payout,
    payment_method,
    distance_km,
    is_peak_hour,
    accepted_at,
    completed_at,
    payout_status,
    order_type,
    payout_breakdown
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    v_payout_amount,
    v_normalized_payment,
    v_distance_km,
    v_is_peak_hour,
    COALESCE(v_order.accepted_at, NOW()),
    NOW(),
    'completed',
    'order',
    json_build_object(
      'base', v_base_payout,
      'distance', v_distance_km * v_per_km_rate,
      'cod_bonus', v_cod_bonus,
      'peak_bonus', v_peak_bonus
    )
  );

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  RETURN json_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout_amount,
    'order_id', p_order_id,
    'distance_km', v_distance_km,
    'is_peak_hour', v_is_peak_hour,
    'breakdown', json_build_object(
      'base', v_base_payout,
      'distance', v_distance_km * v_per_km_rate,
      'cod_bonus', v_cod_bonus,
      'peak_bonus', v_peak_bonus
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in complete_delivery_zepto: %', SQLERRM;
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;