-- Fix the complete_delivery_simple function to ensure amount is never null
CREATE OR REPLACE FUNCTION public.complete_delivery_simple(
  p_order_id UUID,
  p_agent_id UUID,
  p_payout_amount NUMERIC DEFAULT 20,
  p_distance_km NUMERIC DEFAULT 2.5,
  p_payment_method TEXT DEFAULT 'Online'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_wallet_id UUID;
  v_earning_id UUID;
  v_calculated_payout NUMERIC;
BEGIN
  -- Validate and get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Validate and get agent
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found or inactive'
    );
  END IF;

  -- Ensure non-null payout amount with multiple safeguards
  v_calculated_payout := COALESCE(p_payout_amount, 0);
  
  -- If still zero or null, calculate based on distance
  IF v_calculated_payout <= 0 THEN
    v_calculated_payout := CASE 
      WHEN COALESCE(p_distance_km, 0) <= 1 THEN 20 
      ELSE 20 + (COALESCE(p_distance_km, 0) - 1) * 12 
    END;
  END IF;
  
  -- Final safety check - minimum payout is ₹20
  v_calculated_payout := GREATEST(v_calculated_payout, 20);

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = CASE 
      WHEN UPPER(COALESCE(p_payment_method, 'Online')) = 'COD' THEN 'paid_cod'
      ELSE 'paid_online'
    END,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Create or update agent wallet
  INSERT INTO agent_wallet (agent_id, balance)
  VALUES (p_agent_id, v_calculated_payout)
  ON CONFLICT (agent_id) 
  DO UPDATE SET 
    balance = agent_wallet.balance + v_calculated_payout,
    updated_at = NOW()
  RETURNING id INTO v_wallet_id;

  -- Create wallet transaction with guaranteed non-null amount
  INSERT INTO agent_wallet_transactions (
    agent_id, 
    order_id, 
    amount, 
    transaction_type, 
    description,
    status
  )
  VALUES (
    p_agent_id, 
    p_order_id, 
    v_calculated_payout, -- Now guaranteed to be >= 20
    'delivery_payment', 
    format('Delivery payment: %.1fkm, %s payment', COALESCE(p_distance_km, 0), COALESCE(p_payment_method, 'Online')),
    'completed'
  );

  -- Create earnings record
  INSERT INTO earnings (
    agent_id,
    order_id,
    amount,
    status,
    distance_km,
    payment_method,
    description
  )
  VALUES (
    p_agent_id,
    p_order_id,
    v_calculated_payout,
    'completed',
    COALESCE(p_distance_km, 0),
    COALESCE(p_payment_method, 'Online'),
    format('Delivery completed: %.1fkm', COALESCE(p_distance_km, 0))
  )
  RETURNING id INTO v_earning_id;

  -- Update agent stats
  UPDATE delivery_agents 
  SET 
    total_deliveries = total_deliveries + 1,
    deliveries_today = deliveries_today + 1,
    total_earnings = total_earnings + v_calculated_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'payout_amount', v_calculated_payout,
    'distance_km', COALESCE(p_distance_km, 0),
    'payment_method', COALESCE(p_payment_method, 'Online'),
    'earning_id', v_earning_id,
    'wallet_updated', true
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Simple error return without database INSERT (prevents read-only transaction error)
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database operation failed',
      'details', SQLERRM
    );
END;
$$;