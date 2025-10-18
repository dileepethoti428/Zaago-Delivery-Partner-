-- Fix simple_mark_delivered to remove metadata reference and calculate distance from coordinates
DROP FUNCTION IF EXISTS public.simple_mark_delivered(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout_amount NUMERIC := 30; -- Base payout
  v_distance_km NUMERIC := 0;
  v_normalized_payment TEXT;
  v_payment_status TEXT;
  v_pickup_lat NUMERIC;
  v_pickup_lng NUMERIC;
  v_delivery_lat NUMERIC;
  v_delivery_lng NUMERIC;
BEGIN
  -- Normalize payment method
  v_normalized_payment := CASE 
    WHEN UPPER(p_payment_method) IN ('ONLINE', 'UPI', 'CARD', 'RAZORPAY') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  -- Set payment status based on method
  v_payment_status := CASE 
    WHEN v_normalized_payment = 'ONLINE' THEN 'paid'
    ELSE 'pending'
  END;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found'
    );
  END IF;
  
  -- Try to calculate distance from coordinates
  BEGIN
    v_pickup_lat := (v_order.pickup_location->>'lat')::NUMERIC;
    v_pickup_lng := (v_order.pickup_location->>'lng')::NUMERIC;
    v_delivery_lat := (v_order.delivery_address->'coordinates'->>'lat')::NUMERIC;
    v_delivery_lng := (v_order.delivery_address->'coordinates'->>'lng')::NUMERIC;
    
    IF v_pickup_lat IS NOT NULL AND v_pickup_lng IS NOT NULL AND 
       v_delivery_lat IS NOT NULL AND v_delivery_lng IS NOT NULL THEN
      -- Calculate distance using haversine formula
      v_distance_km := calculate_distance(v_pickup_lat, v_pickup_lng, v_delivery_lat, v_delivery_lng);
      v_payout_amount := 12 + (v_distance_km * 3);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If distance calculation fails, use base payout
    v_payout_amount := 30;
  END;
  
  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = v_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Insert into delivery_history
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
    delivery_date,
    completed_at
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.delivery_address->>'fullName', 'Customer'),
    COALESCE(v_order.delivery_address->>'phone', ''),
    v_order.delivery_address,
    v_order.items,
    v_order.total,
    v_normalized_payment,
    v_payment_status,
    v_payout_amount,
    CURRENT_DATE,
    NOW()
  );
  
  -- Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();
  
  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    order_id,
    amount,
    transaction_type,
    description,
    status
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'delivery_payment',
    'Delivery payout: ' || ROUND(v_distance_km, 2) || 'km',
    'completed'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'delivered',
    'payment_method', v_normalized_payment,
    'payment_status', v_payment_status,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;