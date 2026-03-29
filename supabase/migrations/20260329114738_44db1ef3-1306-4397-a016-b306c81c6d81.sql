
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_id uuid := auth.uid();
  v_da_id uuid;
  v_order RECORD;
  v_distance_km numeric;
  v_base_pay numeric := 25;
  v_per_km_rate numeric := 7;
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

  SELECT da.id
    INTO v_da_id
  FROM public.delivery_agents da
  WHERE da.id = p_agent_id
    AND da.agent_id = v_auth_id
    AND COALESCE(da.is_active, true) = true
  LIMIT 1;

  IF v_da_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid agent');
  END IF;

  SELECT id
    INTO v_existing_history
  FROM public.delivery_history
  WHERE order_id = p_order_id
    AND agent_id = v_da_id
  LIMIT 1;

  IF v_existing_history IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'message', 'Delivery already completed'
    );
  END IF;

  SELECT *
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_normalized_payment := lower(trim(coalesce(p_payment_method, '')));
  IF v_normalized_payment IN ('cash', 'cod', 'cash on delivery') THEN
    v_normalized_payment := 'cod';
    v_cod_amount := coalesce(v_order.total, 0);
    v_payment_status := 'collected';
  ELSE
    v_normalized_payment := 'prepaid';
    v_cod_amount := 0;
    v_payment_status := 'paid';
  END IF;

  IF p_live_distance_km IS NOT NULL AND p_live_distance_km > 0 THEN
    v_distance_km := p_live_distance_km;
  ELSE
    v_distance_km := coalesce(v_order.distance_km, 2);
  END IF;

  v_tip := coalesce(v_order.tip_amount, 0);
  v_rounded_distance := ceil(v_distance_km);
  v_payout := v_base_pay + (v_per_km_rate * v_rounded_distance) + v_tip;

  v_payout_breakdown := jsonb_build_object(
    'base_pay', v_base_pay,
    'distance_km', v_distance_km,
    'rounded_distance_km', v_rounded_distance,
    'per_km_rate', v_per_km_rate,
    'distance_pay', v_per_km_rate * v_rounded_distance,
    'tip_amount', v_tip,
    'total_payout', v_payout
  );

  INSERT INTO public.delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, delivery_payout, distance_traveled,
    tip_amount, completed_at, delivery_date
  ) VALUES (
    p_order_id, v_da_id,
    coalesce(v_order.customer_name, 'Customer'),
    v_order.customer_phone,
    coalesce(v_order.address, '{}'::jsonb),
    coalesce(v_order.items, '[]'::jsonb),
    coalesce(v_order.total, 0),
    v_normalized_payment, v_payment_status,
    v_payout, v_distance_km, v_tip,
    now(), current_date
  );

  UPDATE public.orders
  SET status = 'delivered', updated_at = now(), delivered_at = now()
  WHERE id = p_order_id;

  UPDATE public.delivery_agents
  SET total_deliveries = coalesce(total_deliveries, 0) + 1,
      deliveries_today = coalesce(deliveries_today, 0) + 1,
      total_earnings = coalesce(total_earnings, 0) + v_payout,
      last_delivery_at = now(), updated_at = now()
  WHERE id = v_da_id;

  -- Fixed: removed tip_amount column (does not exist in earnings table)
  INSERT INTO public.earnings (
    agent_id, order_id, amount, distance_km, payment_method, status
  ) VALUES (
    v_da_id, p_order_id, v_payout, v_distance_km, v_normalized_payment, 'completed'
  );

  INSERT INTO public.agent_wallet (
    agent_id, balance, total_collected, pending_cod_amount
  ) VALUES (
    v_da_id, v_payout, v_cod_amount,
    CASE WHEN v_normalized_payment = 'cod' THEN v_cod_amount ELSE 0 END
  )
  ON CONFLICT (agent_id) DO UPDATE
  SET balance = coalesce(public.agent_wallet.balance, 0) + v_payout,
      total_collected = coalesce(public.agent_wallet.total_collected, 0) + v_cod_amount,
      pending_cod_amount = CASE
        WHEN v_normalized_payment = 'cod'
          THEN coalesce(public.agent_wallet.pending_cod_amount, 0) + v_cod_amount
        ELSE coalesce(public.agent_wallet.pending_cod_amount, 0)
      END,
      updated_at = now();

  INSERT INTO public.agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, status, description
  ) VALUES (
    v_da_id, p_order_id, v_payout, 'earning', 'completed', 'Delivery payout for order'
  );

  UPDATE public.agent_earnings_tracking
  SET completed_at = now(),
      actual_payout = v_payout,
      distance_km = v_distance_km,
      payment_method = v_normalized_payment,
      payout_status = 'completed',
      tip_amount = v_tip,
      payout_breakdown = v_payout_breakdown,
      updated_at = now()
  WHERE order_id = p_order_id
    AND agent_id = v_da_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout,
    'distance_km', v_distance_km,
    'payout_breakdown', v_payout_breakdown,
    'tip_amount', v_tip,
    'already_completed', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
