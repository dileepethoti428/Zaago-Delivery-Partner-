-- Fix all three database functions with corrected syntax
-- Bug fixes: 
-- 1. Change 'cod_collected' to 'paid_cod'
-- 2. Change 'delivery_address' column to 'address'
-- 3. Fix INSERT syntax errors

CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_qr_code_data text,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'COD'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_status text;
  v_agent_location jsonb := NULL;
  v_customer_location jsonb;
  v_distance_km numeric := 0;
  v_payout_result jsonb;
  v_normalized_payment text;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;

  SELECT order_id INTO v_order_id
  FROM order_qr_codes
  WHERE qr_code_data = p_qr_code_data;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  SELECT status INTO v_order_status FROM orders WHERE id = v_order_id;

  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'order_id', v_order_id, 'already_completed', true);
  END IF;

  UPDATE order_qr_codes SET is_scanned = true, scanned_at = now() WHERE qr_code_data = p_qr_code_data;
  SELECT address INTO v_customer_location FROM orders WHERE id = v_order_id;

  UPDATE orders
  SET status = 'delivered', delivered_at = now(),
      payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid' END,
      payment_method = v_normalized_payment, updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO delivery_completions (order_id, agent_id, payment_method, agent_location, customer_location, distance_km, status)
  VALUES (v_order_id, p_agent_id, v_normalized_payment, v_agent_location, v_customer_location, v_distance_km, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO delivery_history (order_id, agent_id, customer_name, customer_phone, delivery_address, items, total_amount, delivery_date, payment_method, payment_status, delivery_payout, agent_location, distance_traveled)
  SELECT v_order_id, p_agent_id, o.customer_name, o.customer_phone, o.address, o.items, o.total, CURRENT_DATE, v_normalized_payment,
         CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END, 0, v_agent_location, v_distance_km
  FROM orders o WHERE o.id = v_order_id
  ON CONFLICT (order_id) DO NOTHING;

  v_payout_result := process_delivery_payout_safe(p_agent_id, v_order_id, v_distance_km, now());

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed via QR scan', 'order_id', v_order_id, 
                            'payout_amount', COALESCE((v_payout_result->>'total_payout')::numeric, 30));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'COD'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_status text;
  v_agent_location jsonb := NULL;
  v_customer_location jsonb;
  v_distance_km numeric := 0;
  v_payout_result jsonb;
  v_normalized_payment text;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;

  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'order_id', p_order_id, 'already_completed', true);
  END IF;

  SELECT address INTO v_customer_location FROM orders WHERE id = p_order_id;

  UPDATE orders
  SET status = 'delivered', delivered_at = now(),
      payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid' END,
      payment_method = v_normalized_payment, updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO delivery_completions (order_id, agent_id, payment_method, agent_location, customer_location, distance_km, status)
  VALUES (p_order_id, p_agent_id, v_normalized_payment, v_agent_location, v_customer_location, v_distance_km, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  INSERT INTO delivery_history (order_id, agent_id, customer_name, customer_phone, delivery_address, items, total_amount, delivery_date, payment_method, payment_status, delivery_payout, agent_location, distance_traveled)
  SELECT p_order_id, p_agent_id, o.customer_name, o.customer_phone, o.address, o.items, o.total, CURRENT_DATE, v_normalized_payment,
         CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END, 0, v_agent_location, v_distance_km
  FROM orders o WHERE o.id = p_order_id
  ON CONFLICT (order_id) DO NOTHING;

  v_payout_result := process_delivery_payout_safe(p_agent_id, p_order_id, v_distance_km, now());

  RETURN jsonb_build_object('success', true, 'message', 'Delivery completed manually', 'order_id', p_order_id,
                            'payout_amount', COALESCE((v_payout_result->>'total_payout')::numeric, 30));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'COD'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_payment text;
BEGIN
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;

  UPDATE orders
  SET status = 'delivered', delivered_at = now(),
      payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'paid_cod' ELSE 'paid' END,
      payment_method = v_normalized_payment, updated_at = now()
  WHERE id = p_order_id AND agent_id = p_agent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not assigned to agent');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Order marked as delivered', 'order_id', p_order_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;