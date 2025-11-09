-- Drop all conflicting overloaded function variants
DROP FUNCTION IF EXISTS public.manual_complete_delivery(text, uuid, text);
DROP FUNCTION IF EXISTS public.manual_complete_delivery(text, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.manual_complete_delivery(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(text, uuid, text);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(uuid, uuid, text, numeric);

-- Recreate manual_complete_delivery with single canonical signature
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km numeric;
  v_payout numeric;
  v_payment_method text;
  v_payment_status text;
  v_customer_name text;
  v_customer_phone text;
BEGIN
  -- Check if order already delivered
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  -- Normalize payment method
  v_payment_method := CASE 
    WHEN UPPER(TRIM(p_payment_method)) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;
  
  v_payment_status := CASE 
    WHEN v_payment_method = 'COD' THEN 'pending'
    ELSE 'paid'
  END;
  
  -- Resolve customer name and phone with fallbacks
  SELECT 
    COALESCE(
      v_order.customer_name,
      (v_order.address->>'name'),
      p.full_name,
      'Unknown Customer'
    ),
    COALESCE(
      v_order.customer_phone,
      (v_order.address->>'phone'),
      p.phone,
      'N/A'
    )
  INTO v_customer_name, v_customer_phone
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.id = v_order.user_id
  LIMIT 1;
  
  -- Calculate distance and payout
  v_distance_km := COALESCE(p_live_distance_km, v_order.distance_km, 5);
  v_payout := GREATEST(30, v_distance_km * 6);
  
  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_payout,
    distance_traveled,
    delivery_date,
    payment_method,
    payment_status,
    special_instructions
  ) VALUES (
    p_order_id,
    p_agent_id,
    v_customer_name,
    v_customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    v_payout,
    v_distance_km,
    NOW(),
    v_payment_method,
    v_payment_status,
    v_order.special_instructions
  );
  
  -- Update order status
  UPDATE orders SET
    status = 'delivered',
    delivered = true,
    delivered_at = NOW()
  WHERE id = p_order_id;
  
  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;
  
  -- Update agent_earnings_tracking (fix column name: status -> payout_status)
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed',
    completed_at = NOW(),
    actual_payout = v_payout
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance_km,
    'already_completed', false
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Recreate simple_mark_delivered with single canonical signature
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km numeric;
  v_payout numeric;
  v_payment_method text;
  v_payment_status text;
  v_customer_name text;
  v_customer_phone text;
BEGIN
  -- Check if order already delivered
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  -- Normalize payment method
  v_payment_method := CASE 
    WHEN UPPER(TRIM(p_payment_method)) IN ('COD', 'COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;
  
  v_payment_status := CASE 
    WHEN v_payment_method = 'COD' THEN 'pending'
    ELSE 'paid'
  END;
  
  -- Resolve customer name and phone with fallbacks
  SELECT 
    COALESCE(
      v_order.customer_name,
      (v_order.address->>'name'),
      p.full_name,
      'Unknown Customer'
    ),
    COALESCE(
      v_order.customer_phone,
      (v_order.address->>'phone'),
      p.phone,
      'N/A'
    )
  INTO v_customer_name, v_customer_phone
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.id = v_order.user_id
  LIMIT 1;
  
  -- Calculate distance and payout
  v_distance_km := COALESCE(p_live_distance_km, v_order.distance_km, 5);
  v_payout := GREATEST(30, v_distance_km * 6);
  
  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_payout,
    distance_traveled,
    delivery_date,
    payment_method,
    payment_status,
    special_instructions
  ) VALUES (
    p_order_id,
    p_agent_id,
    v_customer_name,
    v_customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    v_payout,
    v_distance_km,
    NOW(),
    v_payment_method,
    v_payment_status,
    v_order.special_instructions
  );
  
  -- Update order status
  UPDATE orders SET
    status = 'delivered',
    delivered = true,
    delivered_at = NOW()
  WHERE id = p_order_id;
  
  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;
  
  -- Update agent_earnings_tracking (fix column name: status -> payout_status)
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed',
    completed_at = NOW(),
    actual_payout = v_payout
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance_km,
    'already_completed', false
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;