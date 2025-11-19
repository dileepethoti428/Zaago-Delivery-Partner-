-- Fix column name references in delivery completion functions
-- The orders table has 'address' and 'total', not 'delivery_address' and 'total_amount'

CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id TEXT,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_payout NUMERIC := 30;
  v_already_exists BOOLEAN;
BEGIN
  -- Early check for existing delivery history
  SELECT EXISTS(
    SELECT 1 FROM delivery_history 
    WHERE order_id = p_order_id AND agent_id = p_agent_id
  ) INTO v_already_exists;
  
  IF v_already_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout
    );
  END IF;

  -- Get order details (using correct column names)
  SELECT id, address, total, items, user_id 
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Insert delivery history with conflict handling
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    total_amount,
    items,
    payment_method,
    payment_status,
    delivery_payout,
    delivery_date,
    completed_at
  )
  VALUES (
    p_order_id,
    p_agent_id,
    COALESCE((v_order.address->>'name')::TEXT, 'Customer'),
    (v_order.address->>'phone')::TEXT,
    v_order.address,
    v_order.total,
    v_order.items,
    UPPER(p_payment_method),
    CASE WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    v_payout,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout
    );
  END IF;

  -- Update order status
  UPDATE orders 
  SET status = 'delivered',
      payment_status = CASE WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid' ELSE payment_status END,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_payout,
      deliveries_today = COALESCE(deliveries_today, 0) + 1,
      last_delivery_at = NOW(),
      updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance)
  VALUES (p_agent_id, v_payout)
  ON CONFLICT (agent_id) 
  DO UPDATE SET 
    balance = agent_wallet.balance + v_payout,
    updated_at = NOW();

  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    order_id,
    transaction_type,
    amount,
    description,
    status
  )
  VALUES (
    p_agent_id,
    p_order_id,
    'delivery_payout',
    v_payout,
    'Delivery completion payout',
    'completed'
  );

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET payout_status = 'confirmed',
      actual_payout = v_payout,
      completed_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id TEXT,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_payout NUMERIC := 30;
  v_already_exists BOOLEAN;
BEGIN
  -- Early check for existing delivery history
  SELECT EXISTS(
    SELECT 1 FROM delivery_history 
    WHERE order_id = p_order_id AND agent_id = p_agent_id
  ) INTO v_already_exists;
  
  IF v_already_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout
    );
  END IF;

  -- Get order details (using correct column names)
  SELECT id, address, total, items
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Insert delivery history with conflict handling
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    delivery_address,
    total_amount,
    items,
    payment_method,
    payment_status,
    delivery_payout,
    delivery_date,
    completed_at
  )
  VALUES (
    p_order_id,
    p_agent_id,
    COALESCE((v_order.address->>'name')::TEXT, 'Customer'),
    v_order.address,
    v_order.total,
    v_order.items,
    UPPER(p_payment_method),
    CASE WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid' ELSE 'pending' END,
    v_payout,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', v_payout
    );
  END IF;

  -- Update order status
  UPDATE orders 
  SET status = 'delivered', 
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'payout_amount', v_payout
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;