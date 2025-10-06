-- Add unique constraint to delivery_completions
ALTER TABLE delivery_completions 
ADD CONSTRAINT unique_delivery_completion UNIQUE (order_id, agent_id);

-- Drop existing functions first
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(text, uuid, text);
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid, text);

-- Recreate qr_complete_delivery_v3 with idempotency
CREATE FUNCTION qr_complete_delivery_v3(
  p_qr_code_data TEXT,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order RECORD;
  v_existing_completion RECORD;
BEGIN
  -- Validate QR code and get order
  SELECT o.id, o.status, o.agent_id, o.total, o.user_id, o.delivery_address
  INTO v_order
  FROM order_qr_codes qr
  JOIN orders o ON o.id = qr.order_id
  WHERE qr.qr_code_data = p_qr_code_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  v_order_id := v_order.id;

  -- Check if already completed by this agent (IDEMPOTENCY CHECK)
  SELECT * INTO v_existing_completion
  FROM delivery_completions
  WHERE order_id = v_order_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already completed',
      'order_id', v_order_id,
      'payout_amount', v_existing_completion.payout_amount,
      'already_completed', true
    );
  END IF;

  -- Check if order can be completed
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already delivered');
  END IF;

  IF v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Update order status
  UPDATE orders
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_status = CASE 
        WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
        ELSE 'paid'
      END,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- Mark QR as scanned
  UPDATE order_qr_codes
  SET is_scanned = true, scanned_at = NOW()
  WHERE qr_code_data = p_qr_code_data;

  -- Insert into delivery_completions
  INSERT INTO delivery_completions (order_id, agent_id, payment_method, payout_amount, status)
  VALUES (v_order_id, p_agent_id, UPPER(p_payment_method), 30, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Insert into delivery_history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status,
    delivery_payout, completed_at
  )
  SELECT 
    v_order_id, p_agent_id, 
    COALESCE((v_order.delivery_address->>'fullName'), (v_order.delivery_address->>'user_name'), 'Customer'),
    v_order.delivery_address,
    o.items, o.total, CURRENT_DATE, UPPER(p_payment_method), 
    CASE WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod' ELSE 'paid' END,
    30, NOW()
  FROM orders o
  WHERE o.id = v_order_id
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1,
      deliveries_today = deliveries_today + 1,
      total_earnings = total_earnings + 30,
      last_delivery_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', v_order_id,
    'payout_amount', 30
  );
END;
$$;

-- Recreate manual_complete_delivery with idempotency
CREATE FUNCTION manual_complete_delivery(
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
  v_existing_completion RECORD;
BEGIN
  -- Check if already completed (IDEMPOTENCY CHECK)
  SELECT * INTO v_existing_completion
  FROM delivery_completions
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already completed',
      'order_id', p_order_id,
      'payout_amount', v_existing_completion.payout_amount,
      'already_completed', true
    );
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already delivered');
  END IF;

  IF v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Update order
  UPDATE orders
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_status = CASE 
        WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
        ELSE 'paid'
      END,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert completions
  INSERT INTO delivery_completions (order_id, agent_id, payment_method, payout_amount, status)
  VALUES (p_order_id, p_agent_id, UPPER(p_payment_method), 30, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status,
    delivery_payout, completed_at
  )
  SELECT 
    p_order_id, p_agent_id,
    COALESCE((v_order.delivery_address->>'fullName'), (v_order.delivery_address->>'user_name'), 'Customer'),
    v_order.delivery_address,
    v_order.items, v_order.total, CURRENT_DATE, UPPER(p_payment_method),
    CASE WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod' ELSE 'paid' END,
    30, NOW()
  FROM orders o
  WHERE o.id = p_order_id
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1,
      deliveries_today = deliveries_today + 1,
      total_earnings = total_earnings + 30,
      last_delivery_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', 30
  );
END;
$$;

-- Recreate simple_mark_delivered with idempotency
CREATE FUNCTION simple_mark_delivered(
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
  v_existing_completion RECORD;
BEGIN
  -- Check if already completed (IDEMPOTENCY CHECK)
  SELECT * INTO v_existing_completion
  FROM delivery_completions
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already completed',
      'order_id', p_order_id,
      'payout_amount', v_existing_completion.payout_amount,
      'already_completed', true
    );
  END IF;

  -- Get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already delivered');
  END IF;

  -- Simple update
  UPDATE orders
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_status = CASE 
        WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
        ELSE 'paid'
      END
  WHERE id = p_order_id;

  -- Insert completion records
  INSERT INTO delivery_completions (order_id, agent_id, payment_method, payout_amount, status)
  VALUES (p_order_id, p_agent_id, UPPER(p_payment_method), 30, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status,
    delivery_payout, completed_at
  )
  SELECT 
    p_order_id, p_agent_id,
    COALESCE((v_order.delivery_address->>'fullName'), (v_order.delivery_address->>'user_name'), 'Customer'),
    v_order.delivery_address,
    v_order.items, v_order.total, CURRENT_DATE, UPPER(p_payment_method),
    CASE WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod' ELSE 'paid' END,
    30, NOW()
  FROM orders o
  WHERE o.id = p_order_id
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery marked as completed',
    'order_id', p_order_id,
    'payout_amount', 30
  );
END;
$$;