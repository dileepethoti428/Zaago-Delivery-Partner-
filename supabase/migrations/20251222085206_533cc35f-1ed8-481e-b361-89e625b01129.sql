-- Fix column references in delivery completion functions
-- The orders table uses 'address' not 'delivery_address', 'total' not 'total_amount'

-- 1. Fix manual_complete_delivery function
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
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
  v_payout_amount NUMERIC;
  v_result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered');
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  
  -- Use default distance since orders table doesn't have distance_km
  v_distance_km := 2.0;
  v_payout_amount := GREATEST(25, v_distance_km * 8);
  
  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = 'paid',
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Create delivery history record
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
    distance_traveled,
    delivery_payout
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    v_order.customer_phone,
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    p_payment_method,
    'paid',
    CURRENT_DATE,
    NOW(),
    v_distance_km,
    v_payout_amount
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_status = 'paid',
    updated_at = NOW();
  
  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'delivered',
    'payment_status', 'paid',
    'payout_amount', v_payout_amount
  );
END;
$$;

-- 2. Fix simple_mark_delivered function
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Update order
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = 'paid',
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Create delivery history
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
    completed_at
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    v_order.customer_phone,
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    'cod',
    'paid',
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_status = 'paid',
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- 3. Fix qr_complete_delivery_v3 function
CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'cod',
  p_qr_code_data TEXT DEFAULT NULL
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
  v_payout_amount NUMERIC;
  v_payment_status TEXT;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'order_id', p_order_id);
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  
  -- Calculate distance and payout
  v_distance_km := 2.0;
  v_payout_amount := GREATEST(25, v_distance_km * 8);
  
  -- Payment status is always 'paid' on delivery completion
  v_payment_status := 'paid';
  
  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = v_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Create delivery history record with correct column names
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
    distance_traveled,
    delivery_payout
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    v_order.customer_phone,
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    COALESCE(p_payment_method, 'cod'),
    v_payment_status,
    CURRENT_DATE,
    NOW(),
    v_distance_km,
    v_payout_amount
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_status = v_payment_status,
    payment_method = COALESCE(p_payment_method, 'cod'),
    distance_traveled = v_distance_km,
    delivery_payout = v_payout_amount,
    updated_at = NOW();
  
  -- Update agent statistics
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    last_delivery_at = NOW(),
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    updated_at = NOW()
  WHERE id = p_agent_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'delivered',
    'payment_status', v_payment_status,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km
  );
END;
$$;