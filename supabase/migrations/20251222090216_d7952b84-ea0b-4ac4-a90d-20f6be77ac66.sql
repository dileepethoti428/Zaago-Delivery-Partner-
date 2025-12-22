-- Fix ON CONFLICT target to match existing UNIQUE (order_id, agent_id)

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'cod'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout numeric := 25.0;
  v_distance numeric := 2.0;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'cod')) IN ('ONLINE', 'PREPAID', 'UPI', 'CARD') THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Get order (using correct column names: address, total)
  SELECT id, address, total, customer_name, customer_phone, items, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already delivered');
  END IF;

  -- Get agent
  SELECT id, name FROM delivery_agents WHERE id = p_agent_id INTO v_agent;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Insert delivery history (using correct column names)
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, distance_traveled, delivery_payout,
    completed_at, delivery_date
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, v_normalized_payment,
    'paid', v_distance, v_payout,
    NOW(), CURRENT_DATE
  )
  ON CONFLICT (order_id, agent_id) DO UPDATE SET
    payment_status = 'paid',
    completed_at = NOW();

  -- Update order status
  UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance)
  VALUES (p_agent_id, v_payout)
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = COALESCE(agent_wallet.balance, 0) + v_payout,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed',
    'payout', v_payout
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'cod'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout numeric := 25.0;
  v_distance numeric := 2.0;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'cod')) IN ('ONLINE', 'PREPAID', 'UPI', 'CARD') THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Get order (using correct column names: address, total)
  SELECT id, address, total, customer_name, customer_phone, items, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already delivered');
  END IF;

  -- Get agent
  SELECT id, name FROM delivery_agents WHERE id = p_agent_id INTO v_agent;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, distance_traveled, delivery_payout,
    completed_at, delivery_date
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, v_normalized_payment,
    'paid', v_distance, v_payout,
    NOW(), CURRENT_DATE
  )
  ON CONFLICT (order_id, agent_id) DO UPDATE SET
    payment_status = 'paid',
    completed_at = NOW();

  -- Update order status
  UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance)
  VALUES (p_agent_id, v_payout)
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = COALESCE(agent_wallet.balance, 0) + v_payout,
    updated_at = NOW();

  -- Update earnings tracking
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed',
    actual_payout = v_payout,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'payout', v_payout,
    'order_id', p_order_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'COD'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout numeric := 25.0;
  v_distance numeric := 2.0;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'COD')) IN ('ONLINE', 'PREPAID', 'UPI', 'CARD') THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Get order (using correct column names: address, total)
  SELECT id, address, total, customer_name, customer_phone, items, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already delivered', 'already_completed', true);
  END IF;

  -- Get agent
  SELECT id, name FROM delivery_agents WHERE id = p_agent_id INTO v_agent;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, distance_traveled, delivery_payout,
    completed_at, delivery_date
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, v_normalized_payment,
    'paid', v_distance, v_payout,
    NOW(), CURRENT_DATE
  )
  ON CONFLICT (order_id, agent_id) DO UPDATE SET
    payment_status = 'paid',
    completed_at = NOW();

  -- Update order status
  UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance)
  VALUES (p_agent_id, v_payout)
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = COALESCE(agent_wallet.balance, 0) + v_payout,
    updated_at = NOW();

  -- Update earnings tracking
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed',
    actual_payout = v_payout,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'QR delivery completed successfully',
    'payout', v_payout,
    'order_id', p_order_id,
    'payment_method', v_normalized_payment
  );
END;
$function$;
