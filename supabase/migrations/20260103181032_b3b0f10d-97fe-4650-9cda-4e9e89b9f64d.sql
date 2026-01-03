-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(UUID, UUID, TEXT);

-- Recreate with proper UUID handling (no ::text casts)
CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout NUMERIC;
  v_distance_km NUMERIC;
  v_existing_delivery RECORD;
  v_base_fee NUMERIC := 20;
  v_per_km_rate NUMERIC := 8;
  v_peak_hour_bonus NUMERIC := 0;
  v_is_peak_hour BOOLEAN := FALSE;
  v_current_hour INTEGER;
  v_cod_amount NUMERIC := 0;
  v_payment_method_clean TEXT;
BEGIN
  -- IDEMPOTENCY CHECK: Return early if delivery already completed
  SELECT id, delivery_payout INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF v_existing_delivery.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout', COALESCE(v_existing_delivery.delivery_payout, 0),
      'message', 'Delivery was already completed'
    );
  END IF;

  -- Clean up payment method
  v_payment_method_clean := LOWER(TRIM(COALESCE(p_payment_method, 'cash')));
  IF v_payment_method_clean NOT IN ('cash', 'cod', 'prepaid', 'online', 'upi') THEN
    v_payment_method_clean := 'cash';
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Calculate distance
  v_distance_km := COALESCE(v_order.distance_km, 2.0);

  -- Check peak hours (8-10 AM and 6-9 PM)
  v_current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata');
  IF v_current_hour BETWEEN 8 AND 10 OR v_current_hour BETWEEN 18 AND 21 THEN
    v_is_peak_hour := TRUE;
    v_peak_hour_bonus := 10;
  END IF;

  -- Calculate payout
  v_payout := v_base_fee + (v_distance_km * v_per_km_rate) + v_peak_hour_bonus;
  v_payout := ROUND(v_payout, 2);

  -- Handle COD amount
  IF v_payment_method_clean IN ('cash', 'cod') THEN
    v_cod_amount := COALESCE(v_order.total_amount, 0);
  END IF;

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    delivery_status = 'delivered',
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

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
    delivery_date,
    completed_at
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    COALESCE(v_order.delivery_address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total_amount, 0),
    v_payment_method_clean,
    'completed',
    v_payout,
    v_distance_km,
    CURRENT_DATE,
    NOW()
  );

  -- Insert earnings record
  INSERT INTO earnings (
    agent_id,
    order_id,
    amount,
    distance_km,
    payment_method,
    status,
    description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout,
    v_distance_km,
    v_payment_method_clean,
    'completed',
    'Delivery payout for order ' || p_order_id::text
  );

  -- Handle wallet for COD
  IF v_cod_amount > 0 THEN
    UPDATE agent_wallet
    SET 
      pending_cod_amount = COALESCE(pending_cod_amount, 0) + v_cod_amount,
      total_collected = COALESCE(total_collected, 0) + v_cod_amount,
      updated_at = NOW()
    WHERE agent_id = p_agent_id;

    IF NOT FOUND THEN
      INSERT INTO agent_wallet (agent_id, pending_cod_amount, total_collected, balance)
      VALUES (p_agent_id, v_cod_amount, v_cod_amount, 0);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'distance_km', v_distance_km,
    'is_peak_hour', v_is_peak_hour,
    'cod_amount', v_cod_amount,
    'payment_method', v_payment_method_clean
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;