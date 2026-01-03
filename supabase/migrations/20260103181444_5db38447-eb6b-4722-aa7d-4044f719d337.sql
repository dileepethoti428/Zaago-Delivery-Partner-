-- Drop and recreate complete_delivery_zepto with correct column reference (total instead of total_amount)
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(UUID, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id UUID,
  p_payment_method TEXT,
  p_live_distance_km NUMERIC DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_order RECORD;
  v_distance_km NUMERIC;
  v_base_pay NUMERIC := 25;
  v_per_km_rate NUMERIC := 7;
  v_payout NUMERIC;
  v_rounded_distance NUMERIC;
  v_existing_history UUID;
  v_cod_amount NUMERIC := 0;
  v_payment_status TEXT;
  v_normalized_payment TEXT;
BEGIN
  -- Get agent_id from auth context
  v_agent_id := auth.uid();
  
  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Idempotency check - if delivery already completed, return success with existing data
  SELECT id INTO v_existing_history 
  FROM delivery_history 
  WHERE order_id = p_order_id AND agent_id = v_agent_id;
  
  IF v_existing_history IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Delivery already completed',
      'idempotent', true
    );
  END IF;

  -- Fetch order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Normalize payment method
  v_normalized_payment := LOWER(TRIM(p_payment_method));
  IF v_normalized_payment IN ('cash', 'cod', 'cash on delivery') THEN
    v_normalized_payment := 'cod';
    v_cod_amount := COALESCE(v_order.total, 0);
    v_payment_status := 'collected';
  ELSE
    v_normalized_payment := 'prepaid';
    v_cod_amount := 0;
    v_payment_status := 'paid';
  END IF;

  -- Calculate distance
  IF p_live_distance_km IS NOT NULL AND p_live_distance_km > 0 THEN
    v_distance_km := p_live_distance_km;
  ELSE
    v_distance_km := COALESCE(v_order.distance_km, 2);
  END IF;

  -- Calculate payout
  v_rounded_distance := CEIL(v_distance_km);
  v_payout := v_base_pay + (v_per_km_rate * v_rounded_distance);

  -- Insert delivery history
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
    delivery_payout,
    distance_traveled,
    completed_at,
    delivery_date
  ) VALUES (
    p_order_id,
    v_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    v_normalized_payment,
    v_payment_status,
    v_payout,
    v_distance_km,
    NOW(),
    CURRENT_DATE
  );

  -- Update order status
  UPDATE orders 
  SET status = 'delivered', 
      updated_at = NOW(),
      delivered_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents 
  SET total_deliveries = COALESCE(total_deliveries, 0) + 1,
      deliveries_today = COALESCE(deliveries_today, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + v_payout,
      last_delivery_at = NOW(),
      updated_at = NOW()
  WHERE agent_id = v_agent_id;

  -- Insert earnings record
  INSERT INTO earnings (agent_id, order_id, amount, distance_km, payment_method, status)
  VALUES (v_agent_id, p_order_id, v_payout, v_distance_km, v_normalized_payment, 'completed');

  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, total_collected, pending_cod_amount)
  VALUES (v_agent_id, v_payout, v_cod_amount, CASE WHEN v_normalized_payment = 'cod' THEN v_cod_amount ELSE 0 END)
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout,
    total_collected = agent_wallet.total_collected + v_cod_amount,
    pending_cod_amount = CASE 
      WHEN v_normalized_payment = 'cod' THEN agent_wallet.pending_cod_amount + v_cod_amount 
      ELSE agent_wallet.pending_cod_amount 
    END,
    updated_at = NOW();

  -- Insert wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, status, description)
  VALUES (v_agent_id, p_order_id, v_payout, 'earning', 'completed', 'Delivery payout for order');

  -- Update earnings tracking
  UPDATE agent_earnings_tracking 
  SET completed_at = NOW(),
      actual_payout = v_payout,
      distance_km = v_distance_km,
      payment_method = v_normalized_payment,
      payout_status = 'completed'
  WHERE order_id = p_order_id AND agent_id = v_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'distance_km', v_distance_km,
    'payment_method', v_normalized_payment,
    'cod_amount', v_cod_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;