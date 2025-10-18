-- Fix ON CONFLICT clause in all completion functions
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid);
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(text, uuid, text);

-- Recreate simple_mark_delivered with correct ON CONFLICT
CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status, delivery_payout
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone, v_order.address,
    v_order.items, v_order.total, CURRENT_DATE, 'COD', 'pending', 25.00
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
  UPDATE delivery_agents SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1, last_delivery_at = NOW(), total_earnings = total_earnings + 25.00, updated_at = NOW() WHERE id = p_agent_id;

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'delivery_payment', 'Delivery payout');

  INSERT INTO agent_wallet (agent_id, balance, updated_at) VALUES (p_agent_id, 25.00, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + 25.00, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed', 'order_id', p_order_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Recreate manual_complete_delivery
CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id UUID, p_agent_id UUID, p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_normalized_payment TEXT;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    ELSE 'ONLINE'
  END;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Agent not found'); END IF;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status, delivery_payout
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone, v_order.address,
    v_order.items, v_order.total, CURRENT_DATE, v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END, 25.00
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivered_at = NOW(), payment_status = CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END, updated_at = NOW() WHERE id = p_order_id;
  UPDATE delivery_agents SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1, last_delivery_at = NOW(), total_earnings = total_earnings + 25.00, updated_at = NOW() WHERE id = p_agent_id;

  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, 25.00, 'delivery_payment', 'Delivery payout');

  INSERT INTO agent_wallet (agent_id, balance, updated_at) VALUES (p_agent_id, 25.00, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + 25.00, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed', 'order_id', p_order_id, 'payment_method', v_normalized_payment, 'payout_amount', 25.00);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Recreate qr_complete_delivery_v3
CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_qr_code_data TEXT, p_agent_id UUID, p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_order RECORD;
  v_agent RECORD;
  v_normalized_payment TEXT;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    ELSE 'ONLINE'
  END;

  SELECT order_id INTO v_order_id FROM order_qr_codes WHERE qr_code_data = p_qr_code_data LIMIT 1;
  IF v_order_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code'); END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;

  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Agent not found'); END IF;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status, delivery_payout
  ) VALUES (
    v_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone, v_order.address,
    v_order.items, v_order.total, CURRENT_DATE, v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END, 25.00
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  UPDATE orders SET status = 'delivered', delivered_at = NOW(), payment_status = CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END, updated_at = NOW() WHERE id = v_order_id;
  UPDATE delivery_agents SET total_deliveries = total_deliveries + 1, deliveries_today = deliveries_today + 1, last_delivery_at = NOW(), total_earnings = total_earnings + 25.00, updated_at = NOW() WHERE id = p_agent_id;

  INSERT INTO earnings (agent_id, order_id, amount, status, description) VALUES (p_agent_id, v_order_id, 25.00, 'completed', 'Delivery payout') ON CONFLICT DO NOTHING;
  INSERT INTO agent_wallet (agent_id, balance, updated_at) VALUES (p_agent_id, 25.00, NOW()) ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + 25.00, updated_at = NOW();
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description) VALUES (p_agent_id, v_order_id, 25.00, 'delivery_payment', 'Delivery payout');

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed', 'order_id', v_order_id, 'payment_method', v_normalized_payment);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;