-- Create manual completion function (completely independent from QR completion)
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
  v_agent RECORD;
  v_payout_amount NUMERIC := 30;
  v_payment_status TEXT;
  v_delivery_completion_id UUID;
BEGIN
  -- Get agent details
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found or inactive'
    );
  END IF;
  
  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check if order is already delivered (idempotency)
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'already_delivered', true
    );
  END IF;
  
  -- Verify order is assigned to this agent
  IF v_order.agent_id IS NULL OR v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not assigned to you'
    );
  END IF;
  
  -- Verify order status is ready for delivery
  IF v_order.status NOT IN ('assigned', 'out_for_delivery') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not ready for delivery',
      'current_status', v_order.status
    );
  END IF;
  
  -- Normalize payment method
  p_payment_method := UPPER(TRIM(p_payment_method));
  IF p_payment_method NOT IN ('COD', 'ONLINE') THEN
    p_payment_method := 'ONLINE';
  END IF;
  
  -- Set payment status
  v_payment_status := CASE 
    WHEN p_payment_method = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;
  
  -- Update order to delivered
  UPDATE orders
  SET 
    status = 'delivered',
    payment_method = p_payment_method,
    payment_status = v_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Create delivery completion record
  INSERT INTO delivery_completions (
    order_id,
    agent_id,
    payment_method,
    status,
    completed_at,
    distance_km,
    payout_amount,
    metadata
  ) VALUES (
    p_order_id,
    p_agent_id,
    p_payment_method,
    'completed',
    NOW(),
    0,
    v_payout_amount,
    jsonb_build_object(
      'completion_method', 'manual',
      'completed_by', v_agent.name
    )
  ) RETURNING id INTO v_delivery_completion_id;
  
  -- Create earnings record
  INSERT INTO earnings (
    agent_id,
    order_id,
    amount,
    status,
    description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'completed',
    'Manual delivery completion - Order #' || p_order_id::TEXT
  );
  
  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE
  SET 
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();
  
  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    order_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'delivery_payment',
    'Manual delivery completion payout'
  );
  
  -- Add delivery history record
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    delivery_address,
    items,
    total_amount,
    delivery_date,
    completed_at,
    payment_method,
    payment_status,
    delivery_payout
  ) VALUES (
    p_order_id,
    p_agent_id,
    v_order.customer_name,
    v_order.address,
    v_order.items,
    v_order.total,
    CURRENT_DATE,
    NOW(),
    p_payment_method,
    v_payment_status,
    v_payout_amount
  );
  
  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = total_deliveries + 1,
    deliveries_today = deliveries_today + 1,
    last_delivery_at = NOW(),
    total_earnings = total_earnings + v_payout_amount,
    updated_at = NOW()
  WHERE id = p_agent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'completion_id', v_delivery_completion_id,
    'payout_amount', v_payout_amount,
    'payment_method', p_payment_method,
    'payment_status', v_payment_status
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Manual completion failed: ' || SQLERRM
  );
END;
$$;