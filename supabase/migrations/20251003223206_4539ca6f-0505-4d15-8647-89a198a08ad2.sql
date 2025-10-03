-- Fix QR completion and Mark as Delivered issues
-- Drop and recreate functions with ON CONFLICT DO UPDATE

DROP FUNCTION IF EXISTS qr_complete_delivery_v3(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS nuclear_complete_delivery_bypass(UUID, UUID, TEXT);

-- Recreate qr_complete_delivery_v3 with idempotent delivery_history insert
CREATE FUNCTION qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout NUMERIC := 40;
  v_normalized_payment TEXT;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'DIGITAL') THEN 'ONLINE'
    ELSE 'COD'
  END;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'already_completed', true);
  END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  UPDATE orders SET
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid_online' END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout, 'completed', 'Delivery payout')
  ON CONFLICT (agent_id, order_id) DO NOTHING;

  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout,
    updated_at = NOW();

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout, 'delivery_payment', 'Delivery completed')
  ON CONFLICT DO NOTHING;

  -- KEY FIX: Use ON CONFLICT DO UPDATE for delivery_history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_status, payment_method, delivery_date,
    completed_at, delivery_payout, distance_traveled
  )
  VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total,
    CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid_online' END,
    v_normalized_payment, CURRENT_DATE, NOW(), v_payout, 0
  )
  ON CONFLICT (order_id, agent_id) DO UPDATE SET
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    completed_at = EXCLUDED.completed_at,
    delivery_payout = EXCLUDED.delivery_payout,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout,
    'payment_method', v_normalized_payment
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Recreate nuclear_complete_delivery_bypass with same fix
CREATE FUNCTION nuclear_complete_delivery_bypass(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_payout NUMERIC := 40;
  v_normalized_payment TEXT;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'DIGITAL') THEN 'ONLINE'
    ELSE 'COD'
  END;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'already_completed', true);
  END IF;

  UPDATE orders SET
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid_online' END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout, 'completed', 'Nuclear bypass payout')
  ON CONFLICT (agent_id, order_id) DO NOTHING;

  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + v_payout, updated_at = NOW();

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout, 'delivery_payment', 'Nuclear bypass payment')
  ON CONFLICT DO NOTHING;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_status, payment_method, delivery_date,
    completed_at, delivery_payout, distance_traveled
  )
  VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total,
    CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid_online' END,
    v_normalized_payment, CURRENT_DATE, NOW(), v_payout, 0
  )
  ON CONFLICT (order_id, agent_id) DO UPDATE SET
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    completed_at = EXCLUDED.completed_at,
    delivery_payout = EXCLUDED.delivery_payout,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Nuclear bypass completed', 'order_id', p_order_id, 'payout_amount', v_payout, 'payment_method', v_normalized_payment);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;