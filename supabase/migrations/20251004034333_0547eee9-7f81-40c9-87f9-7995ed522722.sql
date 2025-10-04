-- Drop all old function versions to ensure clean slate
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(text, uuid, text);
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.manual_complete_delivery(uuid, uuid);

-- Create clean QR completion function with correct signature
CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_qr_code_data text,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'COD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order_id uuid;
  v_order_status text;
  v_agent_location jsonb;
  v_customer_location jsonb;
  v_distance_km numeric;
  v_payout_result jsonb;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;

  -- Get order ID from QR code
  SELECT order_id INTO v_order_id
  FROM order_qr_codes
  WHERE qr_code_data = p_qr_code_data;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid QR code'
    );
  END IF;

  -- Idempotency check
  SELECT status INTO v_order_status
  FROM orders
  WHERE id = v_order_id;

  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'order_id', v_order_id,
      'already_completed', true
    );
  END IF;

  -- Mark QR as scanned
  UPDATE order_qr_codes
  SET is_scanned = true, scanned_at = now()
  WHERE qr_code_data = p_qr_code_data;

  -- Get locations
  SELECT current_location INTO v_agent_location
  FROM delivery_agents WHERE id = p_agent_id;

  SELECT delivery_address INTO v_customer_location
  FROM orders WHERE id = v_order_id;

  -- Calculate distance
  v_distance_km := COALESCE(
    calculate_distance(
      (v_agent_location->>'lat')::numeric,
      (v_agent_location->>'lng')::numeric,
      (v_customer_location->'coordinates'->>'lat')::numeric,
      (v_customer_location->'coordinates'->>'lng')::numeric
    ), 0
  );

  -- Update order
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = now(),
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END,
    payment_method = v_normalized_payment,
    updated_at = now()
  WHERE id = v_order_id;

  -- Insert completion record (idempotent)
  INSERT INTO delivery_completions (
    order_id, agent_id, payment_method, agent_location,
    customer_location, distance_km, status
  ) VALUES (
    v_order_id, p_agent_id, v_normalized_payment, v_agent_location,
    v_customer_location, v_distance_km, 'completed'
  ) ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Insert delivery history (idempotent)
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, delivery_date,
    payment_method, payment_status, delivery_payout,
    agent_location, distance_traveled
  )
  SELECT 
    v_order_id, p_agent_id, o.customer_name, o.customer_phone,
    o.delivery_address, o.items, o.total, CURRENT_DATE,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END,
    0, v_agent_location, v_distance_km
  FROM orders o WHERE o.id = v_order_id
  ON CONFLICT (order_id) DO NOTHING;

  -- Process payout
  v_payout_result := process_delivery_payout_safe(p_agent_id, v_order_id, v_distance_km, now());

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed via QR scan',
    'order_id', v_order_id,
    'payout_details', v_payout_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create clean manual completion function
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order RECORD;
  v_agent_location jsonb;
  v_distance_km numeric := 0;
  v_payout_result jsonb;
  v_normalized_payment text;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH') THEN 'COD'
    ELSE 'ONLINE'
  END;

  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Idempotency check
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'order_id', p_order_id,
      'already_completed', true
    );
  END IF;

  -- Verify agent assignment
  IF v_order.agent_id IS NULL OR v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to this agent');
  END IF;

  -- Get agent location
  SELECT current_location INTO v_agent_location
  FROM delivery_agents WHERE id = p_agent_id;

  -- Calculate distance
  IF v_agent_location IS NOT NULL AND v_order.delivery_address IS NOT NULL THEN
    v_distance_km := calculate_distance(
      (v_agent_location->>'lat')::numeric,
      (v_agent_location->>'lng')::numeric,
      (v_order.delivery_address->'coordinates'->>'lat')::numeric,
      (v_order.delivery_address->'coordinates'->>'lng')::numeric
    );
  END IF;

  -- Update order
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = now(),
    payment_status = CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END,
    payment_method = v_normalized_payment,
    updated_at = now()
  WHERE id = p_order_id;

  -- Insert completion (idempotent)
  INSERT INTO delivery_completions (
    order_id, agent_id, payment_method, agent_location,
    customer_location, distance_km, status
  ) VALUES (
    p_order_id, p_agent_id, v_normalized_payment, v_agent_location,
    v_order.delivery_address, v_distance_km, 'completed'
  ) ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Insert history (idempotent)
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, delivery_date,
    payment_method, payment_status, delivery_payout,
    agent_location, distance_traveled
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.delivery_address, v_order.items, v_order.total, CURRENT_DATE,
    v_normalized_payment,
    CASE WHEN v_normalized_payment = 'COD' THEN 'COD Collected' ELSE 'Paid' END,
    0, v_agent_location, v_distance_km
  ) ON CONFLICT (order_id) DO NOTHING;

  -- Process payout
  v_payout_result := process_delivery_payout_safe(p_agent_id, p_order_id, v_distance_km, now());

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed manually',
    'order_id', p_order_id,
    'payment_method', v_normalized_payment,
    'payment_status', CASE WHEN v_normalized_payment = 'COD' THEN 'cod_collected' ELSE 'paid' END,
    'payout_amount', COALESCE((v_payout_result->>'total_payout')::numeric, 0),
    'payout_details', v_payout_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create ultra-simple fallback completion (nuclear option)
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order_status text;
BEGIN
  -- Check current status
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Idempotency
  IF v_order_status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already delivered', 'order_id', p_order_id);
  END IF;

  -- Simple status update - minimal logic
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = now(),
    payment_status = 'cod_collected',
    updated_at = now()
  WHERE id = p_order_id AND agent_id = p_agent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not assigned to order');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Order marked delivered', 'order_id', p_order_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;