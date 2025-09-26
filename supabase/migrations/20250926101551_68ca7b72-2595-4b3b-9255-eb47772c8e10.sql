-- Drop existing conflicting functions
DROP FUNCTION IF EXISTS public.complete_delivery_simple(uuid, uuid, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.complete_delivery_simple(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.simple_complete_delivery(uuid, text, text, uuid);

-- Create the definitive complete_delivery_simple function
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

  -- Ensure non-null payout amount
  v_calculated_payout := COALESCE(p_payout_amount, 
    CASE 
      WHEN p_distance_km <= 1 THEN 20 
      ELSE 20 + (p_distance_km - 1) * 12 
    END
  );
  
  -- Minimum payout is ₹20
  v_calculated_payout := GREATEST(v_calculated_payout, 20);

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = CASE 
      WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
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

  -- Create wallet transaction with proper amount
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
    v_calculated_payout, 
    'delivery_payment', 
    format('Delivery payment: %.1fkm, %s payment', p_distance_km, p_payment_method),
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
    p_distance_km,
    p_payment_method,
    format('Delivery completed: %.1fkm', p_distance_km)
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
    'distance_km', p_distance_km,
    'payment_method', p_payment_method,
    'earning_id', v_earning_id,
    'wallet_updated', true
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error details
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata,
      error
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'delivery_completion_error',
        'order_id', p_order_id,
        'agent_id', p_agent_id,
        'payout_amount', p_payout_amount,
        'distance_km', p_distance_km,
        'payment_method', p_payment_method,
        'error_time', NOW()
      ),
      SQLERRM
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database operation failed',
      'details', SQLERRM
    );
END;
$$;