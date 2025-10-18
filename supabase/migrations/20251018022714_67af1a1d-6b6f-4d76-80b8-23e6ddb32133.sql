-- Drop existing functions
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(uuid, uuid, text);
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid);

-- Recreate qr_complete_delivery_v3 with uppercase payment method
CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
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
  v_payout_amount NUMERIC := 25.00;
  v_existing_earning UUID;
  v_normalized_payment TEXT;
BEGIN
  -- Normalize payment method to uppercase
  v_normalized_payment := UPPER(TRIM(p_payment_method));
  IF v_normalized_payment NOT IN ('COD', 'ONLINE') THEN
    v_normalized_payment := CASE 
      WHEN v_normalized_payment ILIKE '%COD%' OR v_normalized_payment ILIKE '%CASH%' THEN 'COD'
      ELSE 'ONLINE'
    END;
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Check for existing earning (idempotency)
  SELECT id INTO v_existing_earning FROM earnings WHERE agent_id = p_agent_id AND order_id = p_order_id;
  
  IF v_existing_earning IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'earning_id', v_existing_earning,
      'payout_amount', v_payout_amount,
      'payment_method', v_normalized_payment
    );
  END IF;

  -- Update order status to delivered
  UPDATE orders 
  SET status = 'delivered', 
      delivered_at = NOW(),
      payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END,
      updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;

  -- Insert delivery history with uppercase payment method
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_status, payment_method, delivery_payout,
    delivery_date, completed_at
  ) VALUES (
    p_order_id, p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END,
    v_normalized_payment,  -- Use normalized uppercase value
    v_payout_amount,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_method = v_normalized_payment,
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END;

  -- Insert earning
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'completed', 'QR delivery completion')
  RETURNING id INTO v_existing_earning;

  -- Update wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();

  -- Insert wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'delivery_payment', 'QR delivery payout');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout_amount,
    'payment_method', v_normalized_payment,
    'payment_status', CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END
  );
END;
$$;

-- Recreate manual_complete_delivery with uppercase payment method
CREATE OR REPLACE FUNCTION manual_complete_delivery(
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
  v_payout_amount NUMERIC := 25.00;
  v_existing_earning UUID;
  v_normalized_payment TEXT;
BEGIN
  -- Normalize payment method to uppercase
  v_normalized_payment := UPPER(TRIM(p_payment_method));
  IF v_normalized_payment NOT IN ('COD', 'ONLINE') THEN
    v_normalized_payment := CASE 
      WHEN v_normalized_payment ILIKE '%COD%' OR v_normalized_payment ILIKE '%CASH%' THEN 'COD'
      ELSE 'ONLINE'
    END;
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Check for existing earning (idempotency)
  SELECT id INTO v_existing_earning FROM earnings WHERE agent_id = p_agent_id AND order_id = p_order_id;
  
  IF v_existing_earning IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'earning_id', v_existing_earning,
      'payout_amount', v_payout_amount,
      'payment_method', v_normalized_payment
    );
  END IF;

  -- Update order status
  UPDATE orders 
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END,
      updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;

  -- Insert delivery history with uppercase payment method
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_status, payment_method, delivery_payout,
    delivery_date, completed_at
  ) VALUES (
    p_order_id, p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END,
    v_normalized_payment,  -- Use normalized uppercase value
    v_payout_amount,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_method = v_normalized_payment,
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END;

  -- Insert earning
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'completed', 'Manual delivery completion')
  RETURNING id INTO v_existing_earning;

  -- Update wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();

  -- Insert wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'delivery_payment', 'Manual delivery payout');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout_amount,
    'payment_method', v_normalized_payment,
    'payment_status', CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END
  );
END;
$$;

-- Recreate simple_mark_delivered with uppercase payment method
CREATE OR REPLACE FUNCTION simple_mark_delivered(
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
  v_payout_amount NUMERIC := 25.00;
  v_existing_earning UUID;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Check for existing earning (idempotency)
  SELECT id INTO v_existing_earning FROM earnings WHERE agent_id = p_agent_id AND order_id = p_order_id;
  
  IF v_existing_earning IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'earning_id', v_existing_earning
    );
  END IF;

  -- Update order status
  UPDATE orders 
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_status = 'cod_collected',
      updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;

  -- Insert delivery history with uppercase COD
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_status, payment_method, delivery_payout,
    delivery_date, completed_at
  ) VALUES (
    p_order_id, p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    'COD Collected',
    'COD',  -- Uppercase COD
    v_payout_amount,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    payment_method = 'COD',
    payment_status = 'COD Collected';

  -- Insert earning
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'completed', 'Simple delivery completion')
  RETURNING id INTO v_existing_earning;

  -- Update wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();

  -- Insert wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'delivery_payment', 'Simple delivery payout');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout_amount
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION qr_complete_delivery_v3(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION manual_complete_delivery(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION simple_mark_delivered(UUID, UUID) TO authenticated;