-- Fix completed_at constraint issue by letting database handle the default
-- Remove explicit completed_at from INSERT statements in all three functions

-- 1. Fix qr_complete_delivery_v3
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(UUID, UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
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

  -- Insert delivery history WITHOUT explicit completed_at (let DB default handle it)
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

  -- Insert WITHOUT explicit completed_at
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

-- 3. Fix simple_mark_delivered
DROP FUNCTION IF EXISTS public.simple_mark_delivered(UUID, UUID) CASCADE;

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
  v_existing_delivery UUID;
BEGIN
  SELECT id INTO v_existing_delivery
  FROM delivery_history WHERE order_id = p_order_id LIMIT 1;

  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already delivered');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Insert WITHOUT explicit completed_at
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, delivery_date,
    payment_method, payment_status, delivery_payout
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, CURRENT_DATE,
    'COD', 'pending', 25.00
  );

  UPDATE orders
  SET status = 'delivered', delivered_at = NOW(), payment_status = 'pending'
  WHERE id = p_order_id;

  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1
  WHERE id = p_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery marked as completed');
END;
$$;