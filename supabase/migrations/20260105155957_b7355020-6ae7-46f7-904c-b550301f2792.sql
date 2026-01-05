-- Fix COALESCE type mismatch in complete_delivery_zepto
-- Change CURRENT_DATE::TEXT to CURRENT_DATE (both now type date)

DROP FUNCTION IF EXISTS complete_delivery_zepto(UUID, UUID, TEXT);

CREATE FUNCTION complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'cod'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km NUMERIC;
  v_payout NUMERIC;
  v_base_pay CONSTANT NUMERIC := 10;
  v_rate_per_km CONSTANT NUMERIC := 8;
  v_payment_status TEXT;
  v_existing_history UUID;
BEGIN
  RAISE LOG 'complete_delivery_zepto called: order_id=%, agent_id=%, payment_method=%', 
    p_order_id, p_agent_id, p_payment_method;

  -- 1. IDEMPOTENCY CHECK: Check if order already in delivery_history
  SELECT id INTO v_existing_history
  FROM delivery_history
  WHERE order_id = p_order_id
  LIMIT 1;
  
  IF v_existing_history IS NOT NULL THEN
    RAISE LOG 'complete_delivery_zepto: Order % already completed (history_id=%)', p_order_id, v_existing_history;
    RETURN jsonb_build_object(
      'success', true, 
      'already_completed', true,
      'message', 'Order was already completed'
    );
  END IF;

  -- 2. Fetch agent using the passed p_agent_id (delivery_agents.id)
  SELECT id, name, email INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id
    AND is_active = true;
  
  IF v_agent.id IS NULL THEN
    RAISE LOG 'complete_delivery_zepto: Agent not found for id=%', p_agent_id;
    RETURN jsonb_build_object('success', false, 'error', 'Active delivery agent not found');
  END IF;

  -- 3. Fetch order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order.id IS NULL THEN
    RAISE LOG 'complete_delivery_zepto: Order not found %', p_order_id;
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- 4. STATUS GUARD: Only allow completion for appropriate statuses
  IF v_order.status NOT IN ('assigned', 'accepted', 'picked_up', 'out_for_delivery') THEN
    RAISE LOG 'complete_delivery_zepto: Invalid status % for order %', v_order.status, p_order_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Cannot complete delivery. Order status is "%s". Must be assigned/accepted/picked_up/out_for_delivery.', v_order.status)
    );
  END IF;

  -- 5. SUBSCRIPTION GUARD: Don't process subscription orders here
  IF v_order.subscription_id IS NOT NULL THEN
    RAISE LOG 'complete_delivery_zepto: Subscription order % - use subscription flow', p_order_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Use subscription completion flow for subscription orders'
    );
  END IF;

  -- 6. Calculate distance and payout
  v_distance_km := COALESCE(v_order.distance_km, 2.5);
  v_distance_km := CEIL(v_distance_km * 10) / 10;
  v_distance_km := GREATEST(v_distance_km, 0.1);
  
  v_payout := v_base_pay + (v_distance_km * v_rate_per_km);
  v_payout := ROUND(v_payout::NUMERIC, 1);

  -- 7. Determine payment status
  IF p_payment_method IN ('razorpay', 'upi', 'online') THEN
    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'collected';
  END IF;

  -- 8. Insert into delivery_history (unique constraint will prevent duplicates)
  BEGIN
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
    ) VALUES (
      p_order_id,
      p_agent_id,
      COALESCE(v_order.address->>'name', 'Customer'),
      v_order.address->>'phone',
      v_order.address,
      COALESCE(v_order.items, '[]'::jsonb),
      COALESCE(v_order.total, 0),
      p_payment_method,
      v_payment_status,
      COALESCE(v_order.delivery_date, CURRENT_DATE),
      NOW(),
      v_payout,
      v_distance_km
    );
    
    RAISE LOG 'complete_delivery_zepto: Inserted delivery_history for order %, agent %, payout %', 
      p_order_id, p_agent_id, v_payout;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'complete_delivery_zepto: Unique violation - order % already in delivery_history', p_order_id;
      RETURN jsonb_build_object(
        'success', true, 
        'already_completed', true,
        'message', 'Order was already completed (concurrent request)'
      );
  END;

  -- 9. Update order status
  UPDATE orders
  SET status = 'delivered',
      delivered_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 10. Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_payout,
      deliveries_today = COALESCE(deliveries_today, 0) + 1,
      last_delivery_at = NOW(),
      updated_at = NOW()
  WHERE id = p_agent_id;

  -- 11. Insert earnings record
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
    p_payment_method,
    'completed',
    format('Delivery payout: ₹%s base + ₹%s/km × %s km', v_base_pay, v_rate_per_km, v_distance_km)
  );

  -- 12. Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, total_collected)
  VALUES (p_agent_id, v_payout, v_payout)
  ON CONFLICT (agent_id) DO UPDATE
  SET balance = agent_wallet.balance + v_payout,
      total_collected = agent_wallet.total_collected + v_payout,
      updated_at = NOW();

  -- 13. Insert wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    order_id,
    amount,
    transaction_type,
    status,
    description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout,
    'earning',
    'completed',
    format('Delivery earning for order %s', p_order_id)
  );

  -- 14. Update earnings tracking
  UPDATE agent_earnings_tracking
  SET completed_at = NOW(),
      actual_payout = v_payout,
      distance_km = v_distance_km,
      payment_method = p_payment_method,
      payout_status = 'confirmed',
      payout_breakdown = jsonb_build_object(
        'base_pay', v_base_pay,
        'distance_pay', (v_distance_km * v_rate_per_km),
        'distance_km', v_distance_km,
        'rate_per_km', v_rate_per_km
      )
  WHERE order_id = p_order_id
    AND agent_id = p_agent_id;

  RAISE LOG 'complete_delivery_zepto: SUCCESS for order %, payout=%, distance=%km', 
    p_order_id, v_payout, v_distance_km;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance_km,
    'payout_breakdown', jsonb_build_object(
      'base_pay', v_base_pay,
      'distance_pay', (v_distance_km * v_rate_per_km),
      'distance_km', v_distance_km,
      'rate_per_km', v_rate_per_km
    )
  );
END;
$$;