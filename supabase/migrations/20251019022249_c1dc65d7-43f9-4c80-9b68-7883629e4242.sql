-- Handle unique violation as success in safe_complete_delivery
DROP FUNCTION IF EXISTS safe_complete_delivery(uuid, uuid, text);

CREATE OR REPLACE FUNCTION safe_complete_delivery(
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
  v_existing_delivery UUID;
  v_new_payment_status TEXT;
BEGIN
  -- CRITICAL: Lock the order row first to prevent concurrent processing
  SELECT * INTO v_order 
  FROM orders 
  WHERE id = p_order_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;
  
  -- Check agent assignment
  IF v_order.agent_id IS NOT NULL AND v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order assigned to another agent');
  END IF;
  
  -- Check if delivery history already exists
  SELECT id INTO v_existing_delivery 
  FROM delivery_history 
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF v_existing_delivery IS NOT NULL THEN
    -- Update order status if delivery history exists but order not marked delivered
    IF v_order.status != 'delivered' THEN
      UPDATE orders
      SET status = 'delivered', delivered_at = now(), updated_at = now()
      WHERE id = p_order_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;
  
  -- Determine payment status
  IF v_order.payment_status IN ('paid', 'paid_online') THEN
    v_new_payment_status := v_order.payment_status;
  ELSIF p_payment_method = 'COD' THEN
    v_new_payment_status := 'paid_cod';
  ELSE
    v_new_payment_status := 'paid_online';
  END IF;
  
  -- Update order status
  UPDATE orders
  SET status = 'delivered', 
      payment_status = v_new_payment_status,
      delivered_at = now(), 
      updated_at = now()
  WHERE id = p_order_id;
  
  -- Create earnings record (idempotent)
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, 30.00, 'completed', 'Delivery payout')
  ON CONFLICT (agent_id, order_id) DO NOTHING;
  
  -- Create delivery history with CONSTRAINT NAME in ON CONFLICT
  INSERT INTO delivery_history (
    order_id, agent_id, delivery_date, completed_at, total_amount,
    items, delivery_address, customer_name, payment_method,
    payment_status, delivery_payout
  )
  VALUES (
    p_order_id, p_agent_id, CURRENT_DATE, now(), v_order.total,
    v_order.items, v_order.delivery_address,
    COALESCE((v_order.delivery_address->>'user_name')::text, 'Customer'),
    p_payment_method, v_new_payment_status, 30.00
  )
  ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;
  
  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, 30.00, now())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + 30.00,
    updated_at = now();
  
  -- Create wallet transaction (with unique constraint)
  INSERT INTO agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, description, status
  )
  VALUES (
    p_agent_id, p_order_id, 30.00, 'delivery_payment',
    'Delivery payout for order', 'completed'
  )
  ON CONFLICT ON CONSTRAINT unique_agent_wallet_transaction_delivery DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payment_status', v_new_payment_status,
    'payout', 30.00
  );
  
EXCEPTION 
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order being processed by another request',
      'order_id', p_order_id,
      'concurrent_processing', true
    );
  WHEN unique_violation THEN
    -- Handle duplicate key violation as success (delivery already completed)
    -- Update order status if not already delivered
    UPDATE orders
    SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()), updated_at = now()
    WHERE id = p_order_id AND status != 'delivered';
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed (concurrent request)',
      'order_id', p_order_id,
      'already_completed', true
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;