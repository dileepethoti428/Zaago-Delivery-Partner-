-- Fix complete_delivery_zepto: Change 'collected' to 'paid_cod' (valid constraint value)
CREATE OR REPLACE FUNCTION complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km NUMERIC;
  v_base_pay NUMERIC := 10;
  v_distance_rate NUMERIC := 8;
  v_distance_pay NUMERIC;
  v_total_payout NUMERIC;
  v_payment_status TEXT;
  v_payout_breakdown JSONB;
BEGIN
  -- 1. Validate order exists and is assigned to this agent
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND assigned_agent_id = p_agent_id
    AND status IN ('assigned', 'out_for_delivery', 'picked_up');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not assigned to this agent';
  END IF;

  -- 2. Get agent info
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found or inactive';
  END IF;

  -- 3. Get distance from order (already calculated at accept time)
  v_distance_km := COALESCE(v_order.distance_km, 0);

  -- 4. Calculate payout (Zepto-style: base + distance)
  v_distance_pay := ROUND((v_distance_km * v_distance_rate)::NUMERIC, 1);
  v_total_payout := v_base_pay + v_distance_pay;

  -- 5. Build payout breakdown
  v_payout_breakdown := jsonb_build_object(
    'base_pay', v_base_pay,
    'distance_pay', v_distance_pay,
    'distance_km', v_distance_km,
    'rate_per_km', v_distance_rate,
    'total', v_total_payout
  );

  -- 6. Determine payment status (FIXED: use constraint-valid values)
  v_payment_status := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid_online'
    ELSE 'paid_cod'  -- Was 'collected' which violated constraint
  END;

  -- 7. Update order status
  UPDATE orders
  SET 
    status = 'delivered',
    payment_status = v_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 8. Insert/update earnings tracking
  INSERT INTO agent_earnings_tracking (
    order_id,
    agent_id,
    distance_km,
    expected_payout,
    actual_payout,
    payout_status,
    payout_breakdown,
    order_type,
    payment_method,
    accepted_at,
    completed_at
  )
  VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_distance_km, 0),
    COALESCE(v_total_payout, 10),
    COALESCE(v_total_payout, 10),
    'confirmed',
    v_payout_breakdown,
    'regular',
    UPPER(p_payment_method),
    COALESCE(v_order.accepted_at, NOW()),
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    actual_payout = EXCLUDED.actual_payout,
    payout_status = 'confirmed',
    payout_breakdown = EXCLUDED.payout_breakdown,
    payment_method = EXCLUDED.payment_method,
    completed_at = NOW();

  -- 9. Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_total_payout,
    last_delivery_at = NOW(),
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- 10. Return success with payout details
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payout_amount', v_total_payout,
    'distance_km', v_distance_km,
    'payout_breakdown', v_payout_breakdown,
    'payment_status', v_payment_status
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Delivery completion failed: %', SQLERRM;
END;
$$;