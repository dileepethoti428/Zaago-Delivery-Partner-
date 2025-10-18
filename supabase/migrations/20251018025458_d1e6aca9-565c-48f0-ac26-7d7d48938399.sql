-- Fix qr_complete_delivery_v3 to use correct column name 'address' instead of 'delivery_address'
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(text, uuid, text);

CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_qr_code_data TEXT,
  p_agent_id UUID,
  p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_order_record RECORD;
  v_agent_record RECORD;
  v_delivery_address JSONB;
  v_existing_delivery UUID;
  v_normalized_payment TEXT;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH ON DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'PREPAID', 'PAID') THEN 'ONLINE'
    ELSE 'COD'
  END;

  -- Extract order_id from QR code
  v_order_id := (SELECT order_id FROM order_qr_codes WHERE qr_code_data = p_qr_code_data LIMIT 1);
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  -- Check for existing delivery (idempotency)
  SELECT id INTO v_existing_delivery FROM delivery_history WHERE order_id = v_order_id LIMIT 1;
  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery already completed', 'delivery_id', v_existing_delivery);
  END IF;

  -- Get order and agent details
  SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_agent_record FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found or inactive');
  END IF;

  -- ✅ CRITICAL FIX: Use 'address' column instead of 'delivery_address'
  SELECT address INTO v_delivery_address FROM orders WHERE id = v_order_id;

  -- Insert delivery history (completed_at uses DEFAULT now())
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_date,
    payment_method,
    payment_status,
    delivery_payout
  ) VALUES (
    v_order_id,
    p_agent_id,
    v_order_record.customer_name,
    v_order_record.customer_phone,
    v_delivery_address,
    v_order_record.items,
    v_order_record.total,
    CURRENT_DATE,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    25.00
  );

  -- Update order status
  UPDATE orders
  SET status = 'delivered', 
      delivered_at = NOW(),
      payment_status = CASE WHEN v_normalized_payment = 'ONLINE' THEN 'paid' ELSE 'pending' END,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1,
      deliveries_today = deliveries_today + 1,
      last_delivery_at = NOW(),
      total_earnings = total_earnings + 25.00,
      updated_at = NOW()
  WHERE id = p_agent_id;

  -- Create earning record
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, v_order_id, 25.00, 'completed', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, 25.00, NOW())
  ON CONFLICT (agent_id) DO UPDATE 
  SET balance = agent_wallet.balance + 25.00, 
      updated_at = NOW();

  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, v_order_id, 25.00, 'delivery_payment', 'Delivery payout')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', v_order_id,
    'payment_method', v_normalized_payment
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;