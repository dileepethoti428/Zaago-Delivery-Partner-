-- Create database function for safe delivery completion
CREATE OR REPLACE FUNCTION safe_complete_delivery(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_delivery UUID;
  v_order RECORD;
  v_payout_amount NUMERIC := 30;
BEGIN
  -- Check if delivery already exists (idempotency)
  SELECT id INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id AND agent_id = p_agent_id
  LIMIT 1;
  
  IF v_existing_delivery IS NOT NULL THEN
    -- Already completed, ensure order status is correct
    UPDATE orders 
    SET status = 'delivered', 
        delivered_at = COALESCE(delivered_at, now()),
        payment_status = p_payment_method,
        updated_at = now()
    WHERE id = p_order_id AND status != 'delivered';
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'delivery_id', v_existing_delivery
    );
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address,
    items, total_amount, payment_method, payment_status,
    delivery_payout, completed_at
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.delivery_address,
    v_order.items, v_order.total, p_payment_method, 'completed',
    v_payout_amount, now()
  )
  RETURNING id INTO v_existing_delivery;
  
  -- Update order status
  UPDATE orders 
  SET status = 'delivered',
      delivered_at = now(),
      payment_status = p_payment_method,
      updated_at = now()
  WHERE id = p_order_id;
  
  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1,
      deliveries_today = deliveries_today + 1,
      total_earnings = total_earnings + v_payout_amount,
      last_delivery_at = now(),
      updated_at = now()
  WHERE id = p_agent_id;
  
  -- Create earning record
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'completed', 'Delivery payout');
  
  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, now())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = now();
  
  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'delivery_payment', 'Delivery payout for order');
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'delivery_id', v_existing_delivery,
    'payout_amount', v_payout_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create index for faster order lookups
CREATE INDEX IF NOT EXISTS idx_orders_id_status ON orders(id, status);

-- Create index for delivery history lookups
CREATE INDEX IF NOT EXISTS idx_delivery_history_order_agent ON delivery_history(order_id, agent_id);