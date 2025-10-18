-- Add VOLATILE keyword to delivery completion functions to fix read-only transaction errors
-- This allows these functions to execute INSERT/UPDATE statements when called via RPC

-- 1. Fix qr_complete_delivery_v3
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(UUID, UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE  -- CRITICAL: Allows write operations
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_existing_delivery UUID;
  v_normalized_payment TEXT;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'PREPAID', 'PAID') THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Check for existing delivery
  SELECT id INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'delivery_id', v_existing_delivery
    );
  END IF;

  -- Get order and agent
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, delivery_date,
    payment_method, payment_status, delivery_payout
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, CURRENT_DATE,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    25.00
  );

  -- Update order
  UPDATE orders
  SET status = 'delivered', delivered_at = NOW(),
      payment_status = CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END
  WHERE id = p_order_id;

  -- Update agent
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1,
      last_delivery_at = NOW(), total_earnings = total_earnings + 25.00
  WHERE id = p_agent_id;

  -- Earnings and wallet
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'completed', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, 25.00, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + 25.00, updated_at = NOW();

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'delivery_payment', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed',
    'payment_method', v_normalized_payment
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Fix manual_complete_delivery
DROP FUNCTION IF EXISTS public.manual_complete_delivery(UUID, UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE  -- CRITICAL: Allows write operations
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_existing_delivery UUID;
  v_normalized_payment TEXT;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'PREPAID', 'PAID') THEN 'ONLINE'
    ELSE 'COD'
  END;

  SELECT id INTO v_existing_delivery
  FROM delivery_history WHERE order_id = p_order_id LIMIT 1;

  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery already completed');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, delivery_date,
    payment_method, payment_status, delivery_payout
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, CURRENT_DATE,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    25.00
  );

  UPDATE orders
  SET status = 'delivered', delivered_at = NOW(),
      payment_status = CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END
  WHERE id = p_order_id;

  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1,
      last_delivery_at = NOW(), total_earnings = total_earnings + 25.00
  WHERE id = p_agent_id;

  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'completed', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, 25.00, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + 25.00, updated_at = NOW();

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'delivery_payment', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Fix simple_mark_delivered (with payment_method parameter from latest version)
DROP FUNCTION IF EXISTS public.simple_mark_delivered(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(UUID, UUID);

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE  -- CRITICAL: Allows write operations
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout_amount NUMERIC := 30;
  v_distance_km NUMERIC := 0;
  v_normalized_payment TEXT;
  v_payment_status TEXT;
  v_pickup_lat NUMERIC;
  v_pickup_lng NUMERIC;
  v_delivery_lat NUMERIC;
  v_delivery_lng NUMERIC;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'RAZORPAY') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  -- Set payment status
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;
  
  -- Get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Get agent
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  
  -- Calculate distance if coordinates available
  BEGIN
    v_pickup_lat := (v_order.pickup_location->>'lat')::NUMERIC;
    v_pickup_lng := (v_order.pickup_location->>'lng')::NUMERIC;
    v_delivery_lat := (v_order.delivery_address->'coordinates'->>'lat')::NUMERIC;
    v_delivery_lng := (v_order.delivery_address->'coordinates'->>'lng')::NUMERIC;
    
    IF v_pickup_lat IS NOT NULL AND v_pickup_lng IS NOT NULL AND 
       v_delivery_lat IS NOT NULL AND v_delivery_lng IS NOT NULL THEN
      v_distance_km := calculate_distance(v_pickup_lat, v_pickup_lng, v_delivery_lat, v_delivery_lng);
      v_payout_amount := 12 + (v_distance_km * 3);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_payout_amount := 30;
  END;
  
  -- Update order
  UPDATE orders 
  SET status = 'delivered', payment_status = v_payment_status,
      delivered_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, delivery_payout, delivery_date
  ) VALUES (
    p_order_id, p_agent_id,
    COALESCE(v_order.delivery_address->>'fullName', 'Customer'),
    COALESCE(v_order.delivery_address->>'phone', ''),
    v_order.delivery_address, v_order.items, v_order.total,
    v_normalized_payment, v_payment_status, v_payout_amount, CURRENT_DATE
  );
  
  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount, updated_at = NOW();
  
  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, description, status
  ) VALUES (
    p_agent_id, p_order_id, v_payout_amount, 'delivery_payment',
    'Delivery payout: ' || ROUND(v_distance_km, 2) || 'km', 'completed'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'delivered',
    'payment_method', v_normalized_payment,
    'payment_status', v_payment_status,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;