-- Fix conflicting payment_method constraints in delivery_history
-- Step 1: Drop the conflicting lenient constraint
ALTER TABLE delivery_history DROP CONSTRAINT IF EXISTS check_payment_method;

-- Step 2: Ensure only strict constraint remains
ALTER TABLE delivery_history 
DROP CONSTRAINT IF EXISTS delivery_history_payment_method_check;

ALTER TABLE delivery_history 
ADD CONSTRAINT delivery_history_payment_method_check 
CHECK (payment_method IN ('COD', 'ONLINE'));

-- Step 3: Add safety normalization in qr_complete_delivery_v3 function
CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT,
  p_distance_km NUMERIC DEFAULT 0,
  p_customer_location JSONB DEFAULT NULL,
  p_agent_location JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_normalized_payment TEXT;
  v_delivery_payout NUMERIC;
BEGIN
  -- Normalize payment method at database level as final safety net
  v_normalized_payment := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'ONLINE')) IN ('CASH', 'COD') THEN 'COD'
    ELSE 'ONLINE'
  END;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Verify agent
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found'
    );
  END IF;

  -- Check if already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order already delivered'
    );
  END IF;

  -- Calculate payout
  v_delivery_payout := CASE 
    WHEN p_distance_km > 0 THEN 40 + (p_distance_km * 9)
    ELSE 40
  END;

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_normalized_payment,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Create delivery history with normalized payment method
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_date,
    completed_at,
    distance_traveled,
    delivery_payout,
    payment_method,
    payment_status,
    customer_location,
    agent_location
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    COALESCE(v_order.customer_phone, 'N/A'),
    v_order.delivery_address,
    v_order.items,
    v_order.total,
    CURRENT_DATE,
    NOW(),
    p_distance_km,
    v_delivery_payout,
    v_normalized_payment,
    'Completed',
    p_customer_location,
    p_agent_location
  );

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
    v_delivery_payout,
    'completed',
    'Delivery payout for order'
  );

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_delivery_payout, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_delivery_payout,
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
    v_delivery_payout,
    'delivery_payment',
    'Delivery payout for order'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order completed successfully',
    'payout', v_delivery_payout,
    'payment_method', v_normalized_payment
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;