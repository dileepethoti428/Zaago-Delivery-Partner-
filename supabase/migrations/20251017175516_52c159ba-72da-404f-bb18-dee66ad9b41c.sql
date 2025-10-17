-- Fix qr_complete_delivery_v3 and manual_complete_delivery to handle delivery addresses correctly

-- Drop the old overloaded versions of qr_complete_delivery_v3
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(text, uuid, text);
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(uuid, uuid, text, numeric, jsonb, jsonb);

-- Create the corrected qr_complete_delivery_v3 function
CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
  p_qr_code_data text, 
  p_agent_id uuid, 
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
  v_order RECORD;
  v_delivery_address JSONB;
  v_existing_completion RECORD;
  v_normalized_payment TEXT;
  v_payment_status TEXT;
BEGIN
  -- Get order details
  SELECT o.id, o.status, o.agent_id, o.total, o.user_id, o.items
  INTO v_order
  FROM order_qr_codes qr
  JOIN orders o ON o.id = qr.order_id
  WHERE qr.qr_code_data = p_qr_code_data;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  v_order_id := v_order.id;

  -- Check for existing completion (idempotency)
  SELECT * INTO v_existing_completion
  FROM delivery_completions
  WHERE order_id = v_order_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already completed',
      'order_id', v_order_id,
      'payout_amount', v_existing_completion.payout_amount,
      'already_completed', true
    );
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already delivered');
  END IF;

  IF v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH_ON_DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'DIGITAL') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;

  -- Get delivery address from order (it's stored as JSONB in orders table)
  SELECT delivery_address INTO v_delivery_address
  FROM orders
  WHERE id = v_order_id;

  -- Update order
  UPDATE orders
  SET status = 'delivered',
      delivered_at = NOW(),
      payment_method = v_normalized_payment,
      payment_status = v_payment_status,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- Mark QR code as scanned
  UPDATE order_qr_codes
  SET is_scanned = true, scanned_at = NOW()
  WHERE qr_code_data = p_qr_code_data;

  -- Insert delivery completion (with conflict handling)
  INSERT INTO delivery_completions (order_id, agent_id, payment_method, payout_amount, status)
  VALUES (v_order_id, p_agent_id, v_normalized_payment, 30, 'completed')
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Insert into delivery history (with conflict handling)
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address,
    items, total_amount, delivery_date, payment_method, payment_status,
    delivery_payout, completed_at
  )
  VALUES (
    v_order_id, 
    p_agent_id, 
    COALESCE((v_delivery_address->>'fullName'), (v_delivery_address->>'user_name'), 'Customer'),
    v_delivery_address,
    v_order.items, 
    v_order.total, 
    CURRENT_DATE, 
    v_normalized_payment, 
    v_payment_status,
    30, 
    NOW()
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Update agent stats
  UPDATE delivery_agents
  SET total_deliveries = total_deliveries + 1,
      deliveries_today = deliveries_today + 1,
      total_earnings = total_earnings + 30,
      last_delivery_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Delivery completed successfully', 
    'order_id', v_order_id, 
    'payout_amount', 30
  );
END;
$function$;

-- Fix manual_complete_delivery function
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid, 
  p_agent_id uuid, 
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_order RECORD;
  v_delivery_address JSONB;
  v_existing_completion RECORD;
  v_normalized_payment TEXT;
  v_payment_status TEXT;
BEGIN
  -- Check for existing completion (idempotency)
  SELECT * INTO v_existing_completion 
  FROM delivery_completions 
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF FOUND THEN 
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Order already completed', 
      'order_id', p_order_id, 
      'payout_amount', v_existing_completion.payout_amount, 
      'already_completed', true
    ); 
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Order not found'); 
  END IF;
  
  IF v_order.status = 'delivered' THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Order already delivered'); 
  END IF;
  
  IF v_order.agent_id != p_agent_id THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to you'); 
  END IF;
  
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('COD', 'CASH', 'CASH_ON_DELIVERY') THEN 'COD'
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'DIGITAL') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;

  -- Get delivery address
  v_delivery_address := v_order.delivery_address;
  
  -- Update order
  UPDATE orders 
  SET status = 'delivered', 
      delivered_at = NOW(), 
      payment_method = v_normalized_payment,
      payment_status = v_payment_status, 
      updated_at = NOW() 
  WHERE id = p_order_id;
  
  -- Insert delivery completion
  INSERT INTO delivery_completions (order_id, agent_id, payment_method, payout_amount, status) 
  VALUES (p_order_id, p_agent_id, v_normalized_payment, 30, 'completed') 
  ON CONFLICT (order_id, agent_id) DO NOTHING;
  
  -- Insert into delivery history
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, delivery_address, 
    items, total_amount, delivery_date, payment_method, payment_status, 
    delivery_payout, completed_at
  )
  VALUES (
    p_order_id, 
    p_agent_id, 
    COALESCE((v_delivery_address->>'fullName'), (v_delivery_address->>'user_name'), 'Customer'), 
    v_delivery_address, 
    v_order.items, 
    v_order.total, 
    CURRENT_DATE, 
    v_normalized_payment, 
    v_payment_status, 
    30, 
    NOW()
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;
  
  -- Update agent stats
  UPDATE delivery_agents 
  SET total_deliveries = total_deliveries + 1, 
      deliveries_today = deliveries_today + 1, 
      total_earnings = total_earnings + 30, 
      last_delivery_at = NOW() 
  WHERE id = p_agent_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Delivery completed successfully', 
    'order_id', p_order_id, 
    'payout_amount', 30
  );
END; 
$function$;