-- Fix the safe_complete_delivery function with proper idempotency checks
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
  -- Check if delivery already completed (idempotency check)
  SELECT id INTO v_existing_delivery 
  FROM delivery_history 
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.agent_id IS NOT NULL AND v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order assigned to another agent');
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
  
  -- Create earnings record (idempotent with unique constraint)
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, 30.00, 'completed', 'Delivery payout')
  ON CONFLICT (agent_id, order_id) DO NOTHING;
  
  -- Create delivery history record (idempotent with unique constraint)
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
  
  -- Create wallet transaction (idempotent with unique index)
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
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;