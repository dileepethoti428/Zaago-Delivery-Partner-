-- Fix delivery completion functions by dropping and recreating them

-- Drop existing functions
DROP FUNCTION IF EXISTS manual_complete_delivery(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS simple_mark_delivered(UUID, UUID);
DROP FUNCTION IF EXISTS simple_mark_delivered(UUID, UUID, TEXT);

-- 1. Recreate manual_complete_delivery with correct schema
CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_distance_km NUMERIC;
  v_payout_amount NUMERIC;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN json_build_object('success', true, 'already_completed', true, 'payout_amount', 30);
  END IF;

  v_distance_km := COALESCE(v_order.distance_km, 5);
  v_payout_amount := 30;

  INSERT INTO delivery_history (order_id, agent_id, pickup_location, delivery_location, distance_km, payment_method, payout_amount, delivery_status)
  VALUES (p_order_id, p_agent_id, v_order.pickup_location, v_order.delivery_location, v_distance_km, UPPER(p_payment_method), v_payout_amount, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO agent_earnings_tracking (agent_id, order_id, expected_payout, actual_payout, payout_status, distance_km, payment_method, completed_at)
  VALUES (p_agent_id, p_order_id, v_payout_amount, v_payout_amount, 'confirmed', v_distance_km, UPPER(p_payment_method), NOW())
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivery_completed_at = NOW(), payment_method = UPPER(p_payment_method) WHERE id = p_order_id;
  UPDATE delivery_agents SET total_deliveries = COALESCE(total_deliveries, 0) + 1, total_earnings = COALESCE(total_earnings, 0) + v_payout_amount WHERE id = p_agent_id;

  INSERT INTO agent_wallet (agent_id, balance, pending_balance) VALUES (p_agent_id, v_payout_amount, 0)
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + v_payout_amount;

  INSERT INTO agent_wallet_transactions (agent_id, transaction_type, amount, balance_after, description, order_id)
  SELECT p_agent_id, 'credit', v_payout_amount, COALESCE(balance, 0), 'Delivery payout for order ' || p_order_id, p_order_id
  FROM agent_wallet WHERE agent_id = p_agent_id;

  RETURN json_build_object('success', true, 'payout_amount', v_payout_amount, 'already_completed', false);
END;
$$;

-- 2. Recreate qr_complete_delivery_v3 with correct schema
CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_qr_code_data TEXT,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qr_record RECORD;
  v_order RECORD;
  v_distance_km NUMERIC;
  v_payout_amount NUMERIC;
BEGIN
  SELECT * INTO v_qr_record FROM order_qr_codes WHERE qr_code_data = p_qr_code_data;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_qr_record.order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN json_build_object('success', true, 'already_completed', true, 'payout_amount', 30);
  END IF;

  v_distance_km := COALESCE(v_order.distance_km, 5);
  v_payout_amount := 30;

  INSERT INTO delivery_history (order_id, agent_id, pickup_location, delivery_location, distance_km, payment_method, payout_amount, delivery_status)
  VALUES (v_qr_record.order_id, p_agent_id, v_order.pickup_location, v_order.delivery_location, v_distance_km, UPPER(p_payment_method), v_payout_amount, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO agent_earnings_tracking (agent_id, order_id, expected_payout, actual_payout, payout_status, distance_km, payment_method, completed_at)
  VALUES (p_agent_id, v_qr_record.order_id, v_payout_amount, v_payout_amount, 'confirmed', v_distance_km, UPPER(p_payment_method), NOW())
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivery_completed_at = NOW(), payment_method = UPPER(p_payment_method) WHERE id = v_qr_record.order_id;
  UPDATE delivery_agents SET total_deliveries = COALESCE(total_deliveries, 0) + 1, total_earnings = COALESCE(total_earnings, 0) + v_payout_amount WHERE id = p_agent_id;

  INSERT INTO agent_wallet (agent_id, balance, pending_balance) VALUES (p_agent_id, v_payout_amount, 0)
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + v_payout_amount;

  INSERT INTO agent_wallet_transactions (agent_id, transaction_type, amount, balance_after, description, order_id)
  SELECT p_agent_id, 'credit', v_payout_amount, COALESCE(balance, 0), 'Delivery payout for order ' || v_qr_record.order_id, v_qr_record.order_id
  FROM agent_wallet WHERE agent_id = p_agent_id;

  UPDATE order_qr_codes SET is_scanned = true, scanned_at = NOW() WHERE qr_code_data = p_qr_code_data;

  RETURN json_build_object('success', true, 'payout_amount', v_payout_amount, 'already_completed', false);
END;
$$;

-- 3. Recreate simple_mark_delivered with payment_method parameter
CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_payout_amount NUMERIC := 30;
  v_distance_km NUMERIC;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN json_build_object('success', true, 'already_completed', true, 'payout_amount', v_payout_amount);
  END IF;

  v_distance_km := COALESCE(v_order.distance_km, 5);

  INSERT INTO delivery_history (order_id, agent_id, pickup_location, delivery_location, distance_km, payment_method, payout_amount, delivery_status)
  VALUES (p_order_id, p_agent_id, v_order.pickup_location, v_order.delivery_location, v_distance_km, UPPER(p_payment_method), v_payout_amount, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO agent_earnings_tracking (agent_id, order_id, expected_payout, actual_payout, payout_status, distance_km, payment_method, completed_at)
  VALUES (p_agent_id, p_order_id, v_payout_amount, v_payout_amount, 'confirmed', v_distance_km, UPPER(p_payment_method), NOW())
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivery_completed_at = NOW(), payment_method = UPPER(p_payment_method) WHERE id = p_order_id;
  UPDATE delivery_agents SET total_deliveries = COALESCE(total_deliveries, 0) + 1, total_earnings = COALESCE(total_earnings, 0) + v_payout_amount WHERE id = p_agent_id;

  INSERT INTO agent_wallet (agent_id, balance, pending_balance) VALUES (p_agent_id, v_payout_amount, 0)
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + v_payout_amount;

  INSERT INTO agent_wallet_transactions (agent_id, transaction_type, amount, balance_after, description, order_id)
  SELECT p_agent_id, 'credit', v_payout_amount, COALESCE(balance, 0), 'Delivery payout for order ' || p_order_id, p_order_id
  FROM agent_wallet WHERE agent_id = p_agent_id;

  RETURN json_build_object('success', true, 'payout_amount', v_payout_amount, 'already_completed', false);
END;
$$;