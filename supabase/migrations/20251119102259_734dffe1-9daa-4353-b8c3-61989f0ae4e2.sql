-- Fix: Remove non-existent v_order.distance_km reference from delivery completion functions
-- The orders table does not have a distance_km column, causing "record has no field" error

-- Drop existing broken functions
DROP FUNCTION IF EXISTS public.manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(uuid, uuid, text);

-- Recreate manual_complete_delivery WITHOUT v_order.distance_km reference
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_customer_name text;
  v_customer_phone text;
  v_distance_km numeric;
  v_payout numeric;
  v_payment_method text;
  v_payment_status text;
BEGIN
  -- Check if already delivered
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;

  -- Normalize payment method
  v_payment_method := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  v_payment_status := CASE 
    WHEN v_payment_method = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;

  -- Fetch customer info from profiles
  SELECT 
    COALESCE(v_order.customer_name, (v_order.address->>'name'), p.full_name, 'Unknown Customer'),
    COALESCE(v_order.customer_phone, (v_order.address->>'phone'), p.phone, 'N/A')
  INTO v_customer_name, v_customer_phone
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.id = v_order.user_id
  LIMIT 1;

  -- Calculate distance and payout (removed v_order.distance_km reference)
  v_distance_km := 5;
  v_payout := GREATEST(30, v_distance_km * 6);

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address, items,
    total_amount, delivery_payout, distance_traveled, delivery_date,
    payment_method, payment_status, special_instructions
  ) VALUES (
    p_order_id, p_agent_id, v_customer_name, v_customer_phone, v_order.address, v_order.items,
    v_order.total, v_payout, v_distance_km, NOW(), v_payment_method, v_payment_status, v_order.special_instructions
  );

  -- Update order status
  UPDATE orders 
  SET status = 'delivered', delivered = true, delivered_at = NOW() 
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries,0) + 1,
    total_earnings = COALESCE(total_earnings,0) + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed', completed_at = NOW(), actual_payout = v_payout
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

-- Recreate simple_mark_delivered WITHOUT v_order.distance_km reference
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_customer_name text;
  v_customer_phone text;
  v_distance_km numeric;
  v_payout numeric;
  v_payment_method text;
  v_payment_status text;
BEGIN
  -- Check if already delivered
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 30,
      'distance_km', 0
    );
  END IF;

  -- Normalize payment method
  v_payment_method := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'ONLINE'
    ELSE 'COD'
  END;

  v_payment_status := CASE 
    WHEN v_payment_method = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;

  -- Fetch customer info
  SELECT 
    COALESCE(v_order.customer_name, (v_order.address->>'name'), p.full_name, 'Unknown Customer'),
    COALESCE(v_order.customer_phone, (v_order.address->>'phone'), p.phone, 'N/A')
  INTO v_customer_name, v_customer_phone
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.id = v_order.user_id
  LIMIT 1;

  -- Calculate distance and payout (removed v_order.distance_km reference)
  v_distance_km := 5;
  v_payout := GREATEST(30, v_distance_km * 6);

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address, items,
    total_amount, delivery_payout, distance_traveled, delivery_date,
    payment_method, payment_status, special_instructions
  ) VALUES (
    p_order_id, p_agent_id, v_customer_name, v_customer_phone, v_order.address, v_order.items,
    v_order.total, v_payout, v_distance_km, NOW(), v_payment_method, v_payment_status, v_order.special_instructions
  );

  -- Update order status
  UPDATE orders 
  SET status = 'delivered', delivered = true, delivered_at = NOW() 
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries,0) + 1,
    total_earnings = COALESCE(total_earnings,0) + v_payout,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking SET
    payout_status = 'confirmed', completed_at = NOW(), actual_payout = v_payout
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