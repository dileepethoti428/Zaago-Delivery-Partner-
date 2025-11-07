-- Drop existing functions first to allow recreation with new signatures
DROP FUNCTION IF EXISTS manual_complete_delivery(TEXT, UUID, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS simple_mark_delivered(TEXT, UUID, TEXT);

-- Recreate manual_complete_delivery function without pickup_address and with fixed payment status
CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id TEXT,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'cod',
  p_live_distance_km NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  order_data JSON
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km NUMERIC;
  v_payout_amount NUMERIC;
  v_payment_method TEXT;
  v_payment_status TEXT;
BEGIN
  -- Normalize payment method
  v_payment_method := UPPER(COALESCE(p_payment_method, 'cod'));
  
  -- Set payment status based on payment method
  IF v_payment_method = 'COD' THEN
    v_payment_status := 'pending';
  ELSE
    v_payment_status := 'paid';
  END IF;

  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id::uuid;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Order not found', NULL::JSON;
    RETURN;
  END IF;

  -- Get agent details
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Agent not found', NULL::JSON;
    RETURN;
  END IF;

  -- Calculate distance and payout
  v_distance_km := COALESCE(p_live_distance_km, v_order.distance_km, 5.0);
  v_payout_amount := GREATEST(v_distance_km * 10, 40);

  -- Insert delivery history (without pickup_address)
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_payout,
    payment_method,
    payment_status,
    delivery_date,
    completed_at,
    distance_traveled
  ) VALUES (
    v_order.id,
    p_agent_id,
    v_order.customer_name,
    v_order.customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    v_payout_amount,
    v_payment_method,
    v_payment_status,
    v_order.delivery_date,
    NOW(),
    v_distance_km
  );

  -- Update order status and payment status
  UPDATE orders
  SET status = 'delivered',
      payment_status = v_payment_status,
      delivered_at = NOW()
  WHERE id = p_order_id::uuid;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
    current_balance = COALESCE(current_balance, 0) + v_payout_amount
  WHERE id = p_agent_id;

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, last_updated)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) 
  DO UPDATE SET 
    balance = agent_wallet.balance + v_payout_amount,
    last_updated = NOW();

  -- Insert wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    amount,
    transaction_type,
    description,
    order_id,
    balance_after
  ) VALUES (
    p_agent_id,
    v_payout_amount,
    'earning',
    'Delivery completed',
    v_order.id,
    (SELECT balance FROM agent_wallet WHERE agent_id = p_agent_id)
  );

  -- Return success
  RETURN QUERY SELECT 
    true, 
    'Delivery completed successfully',
    json_build_object(
      'order_id', v_order.id,
      'status', 'delivered',
      'payout', v_payout_amount,
      'payment_method', v_payment_method,
      'payment_status', v_payment_status
    );
END;
$$;

-- Recreate simple_mark_delivered function without pickup_address and with fixed payment status
CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id TEXT,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'cod'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_payment_method TEXT;
  v_payment_status TEXT;
BEGIN
  -- Normalize payment method
  v_payment_method := UPPER(COALESCE(p_payment_method, 'cod'));
  
  -- Set payment status based on payment method
  IF v_payment_method = 'COD' THEN
    v_payment_status := 'pending';
  ELSE
    v_payment_status := 'paid';
  END IF;

  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id::uuid;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Order not found';
    RETURN;
  END IF;

  -- Insert minimal delivery history (without pickup_address)
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    payment_method,
    payment_status,
    delivery_date,
    completed_at
  ) VALUES (
    v_order.id,
    p_agent_id,
    v_order.customer_name,
    v_order.customer_phone,
    v_order.address,
    v_order.items,
    v_order.total,
    v_payment_method,
    v_payment_status,
    v_order.delivery_date,
    NOW()
  );

  -- Update order status and payment status
  UPDATE orders
  SET status = 'delivered',
      payment_status = v_payment_status,
      delivered_at = NOW()
  WHERE id = p_order_id::uuid;

  -- Return success
  RETURN QUERY SELECT true, 'Order marked as delivered';
END;
$$;

-- Fix existing orders with contradictory payment data (COD + paid status)
UPDATE orders
SET payment_status = 'pending'
WHERE UPPER(payment_method) = 'COD' 
  AND payment_status = 'paid'
  AND status != 'delivered';

-- Also fix delivered orders in delivery_history
UPDATE delivery_history
SET payment_status = 'pending'
WHERE UPPER(payment_method) = 'COD'
  AND payment_status = 'paid';