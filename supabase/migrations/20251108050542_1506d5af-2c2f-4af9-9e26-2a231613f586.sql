-- ============================================================================
-- CLEAN SLATE: Drop all conflicting function variants
-- ============================================================================

DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid, text);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid, text, numeric);

-- ============================================================================
-- MANUAL COMPLETE DELIVERY - Fixed version with correct schema mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_status text;
  v_customer_name text;
  v_customer_phone text;
  v_delivery_address json;
  v_items json;
  v_total_amount numeric;
  v_special_instructions text;
  v_distance numeric;
  v_payout numeric;
  v_normalized_payment text;
  v_payment_status text;
BEGIN
  -- Check if already delivered
  SELECT status INTO v_order_status
  FROM orders
  WHERE id = p_order_id;

  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;

  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Set payment status
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;

  -- Fetch order data and resolve customer info with fallbacks
  SELECT 
    COALESCE(o.customer_name, da.customer_name, p.full_name, 'Unknown Customer'),
    COALESCE(o.customer_phone, da.customer_phone, p.phone, 'N/A'),
    o.address,
    o.items,
    o.total,
    o.special_instructions
  INTO 
    v_customer_name,
    v_customer_phone,
    v_delivery_address,
    v_items,
    v_total_amount,
    v_special_instructions
  FROM orders o
  LEFT JOIN delivery_addresses da ON o.delivery_address_id = da.id
  LEFT JOIN profiles p ON o.user_id = p.id
  WHERE o.id = p_order_id;

  -- Calculate distance and payout
  v_distance := COALESCE(p_live_distance_km, 5.0);
  v_payout := GREATEST(30, v_distance * 6);

  -- Insert into delivery_history with correct column names
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
    v_delivery_address,
    v_items,
    v_total_amount,
    v_payout,
    v_distance,
    NOW(),
    v_normalized_payment,
    v_payment_status,
    v_special_instructions
  );

  -- Update order status
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = total_deliveries + 1,
    total_earnings = total_earnings + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET status = 'confirmed'
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance,
    'already_completed', false
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'manual_complete_delivery error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================================================
-- SIMPLE MARK DELIVERED - Fixed version with correct schema mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_status text;
  v_customer_name text;
  v_customer_phone text;
  v_delivery_address json;
  v_items json;
  v_total_amount numeric;
  v_special_instructions text;
  v_distance numeric;
  v_payout numeric;
  v_normalized_payment text;
  v_payment_status text;
BEGIN
  -- Check if already delivered
  SELECT status INTO v_order_status
  FROM orders
  WHERE id = p_order_id;

  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;

  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Set payment status
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;

  -- Fetch order data and resolve customer info
  SELECT 
    COALESCE(o.customer_name, da.customer_name, p.full_name, 'Unknown Customer'),
    COALESCE(o.customer_phone, da.customer_phone, p.phone, 'N/A'),
    o.address,
    o.items,
    o.total,
    o.special_instructions
  INTO 
    v_customer_name,
    v_customer_phone,
    v_delivery_address,
    v_items,
    v_total_amount,
    v_special_instructions
  FROM orders o
  LEFT JOIN delivery_addresses da ON o.delivery_address_id = da.id
  LEFT JOIN profiles p ON o.user_id = p.id
  WHERE o.id = p_order_id;

  -- Calculate distance and payout
  v_distance := COALESCE(p_live_distance_km, 5.0);
  v_payout := GREATEST(30, v_distance * 6);

  -- Insert into delivery_history with correct column names
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
    v_delivery_address,
    v_items,
    v_total_amount,
    v_payout,
    v_distance,
    NOW(),
    v_normalized_payment,
    v_payment_status,
    v_special_instructions
  );

  -- Update order status
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = total_deliveries + 1,
    total_earnings = total_earnings + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET status = 'confirmed'
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance,
    'already_completed', false
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'simple_mark_delivered error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;