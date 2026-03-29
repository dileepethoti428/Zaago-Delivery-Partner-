
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, text, uuid, numeric);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id uuid,
  p_payment_method text,
  p_agent_id uuid DEFAULT NULL,
  p_live_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_da_id uuid;
  v_order RECORD;
  v_distance_km numeric;
  v_base_pay numeric := 10;
  v_per_km_rate numeric := 8;
  v_payout numeric;
  v_rounded_distance numeric;
  v_existing_history uuid;
  v_cod_amount numeric := 0;
  v_payment_status text;
  v_normalized_payment text;
  v_tip numeric := 0;
  v_payout_breakdown jsonb;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT da.id INTO v_da_id
  FROM delivery_agents da
  WHERE da.agent_id = v_auth_id AND da.is_active = true
  LIMIT 1;

  IF v_da_id IS NULL AND p_agent_id IS NOT NULL THEN
    SELECT da.id INTO v_da_id
    FROM delivery_agents da
    WHERE da.id = p_agent_id AND da.is_active = true
    LIMIT 1;
  END IF;

  IF v_da_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery agent not found');
  END IF;

  SELECT o.*, COALESCE(o.tip_amount, 0) AS resolved_tip
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'message', 'Order already delivered');
  END IF;

  v_distance_km := COALESCE(p_live_distance_km, v_order.delivery_distance_km, 0);
  v_rounded_distance := round(v_distance_km::numeric, 1);
  v_tip := COALESCE(v_order.resolved_tip, 0);
  v_payout := v_base_pay + (v_rounded_distance * v_per_km_rate) + v_tip;

  v_normalized_payment := lower(COALESCE(p_payment_method, v_order.payment_method, 'prepaid'));
  v_payment_status := CASE WHEN v_normalized_payment IN ('cod', 'cash') THEN 'pending' ELSE 'paid' END;
  v_cod_amount := CASE WHEN v_normalized_payment IN ('cod', 'cash') THEN COALESCE(v_order.final_amount, v_order.total_amount, 0) ELSE 0 END;

  UPDATE orders
  SET status = 'delivered',
      delivered_at = now(),
      delivery_agent_id = v_da_id,
      payment_method = v_normalized_payment,
      payment_status = v_payment_status
  WHERE id = p_order_id;

  v_payout_breakdown := jsonb_build_object(
    'base_pay', v_base_pay,
    'distance_km', v_rounded_distance,
    'per_km_rate', v_per_km_rate,
    'distance_pay', v_rounded_distance * v_per_km_rate,
    'tip', v_tip,
    'total_payout', v_payout
  );

  SELECT id INTO v_existing_history FROM delivery_history WHERE order_id = p_order_id LIMIT 1;

  IF v_existing_history IS NULL THEN
    INSERT INTO delivery_history (
      order_id, agent_id, delivery_payout, distance_traveled,
      payment_method, tip_amount, completed_at
    )
    VALUES (
      p_order_id, v_da_id, v_payout, v_rounded_distance,
      v_normalized_payment, v_tip, now()
    );
  END IF;

  INSERT INTO earnings (agent_id, order_id, amount, distance_km, payment_method, status)
  VALUES (v_da_id, p_order_id, v_payout, v_rounded_distance, v_normalized_payment, 'completed')
  ON CONFLICT DO NOTHING;

  INSERT INTO agent_earnings_tracking (
    agent_id, order_id, accepted_at, completed_at,
    expected_payout, actual_payout, distance_km,
    is_peak_hour, payout_status, payout_breakdown,
    payment_method, tip_amount, order_type
  )
  VALUES (
    v_da_id, p_order_id, now(), now(),
    v_payout, v_payout, v_rounded_distance,
    false, 'confirmed', v_payout_breakdown,
    v_normalized_payment, v_tip, 'regular'
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_rounded_distance,
    'tip', v_tip,
    'payout_breakdown', v_payout_breakdown,
    'already_completed', false
  );
END;
$$;
