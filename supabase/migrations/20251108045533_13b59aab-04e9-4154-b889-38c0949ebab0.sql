-- Drop all versions of the functions to avoid overloading issues
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS manual_complete_delivery(uuid, uuid, text, numeric);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid, text);
DROP FUNCTION IF EXISTS simple_mark_delivered(uuid, uuid, text, numeric);

-- Recreate manual_complete_delivery with smart customer data fetching
CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text,
  p_live_distance_km numeric DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_order_record RECORD;
  v_distance_km numeric;
  v_payout_amount numeric;
  v_payment_status text;
  v_resolved_customer_name text;
  v_resolved_customer_phone text;
BEGIN
  -- Fetch order with customer data from multiple sources
  SELECT 
    o.*,
    COALESCE(o.customer_name, da.user_name, p.full_name, 'Unknown Customer') as resolved_customer_name,
    COALESCE(o.customer_phone, da.phone, p.phone, 'N/A') as resolved_customer_phone
  INTO v_order_record
  FROM orders o
  LEFT JOIN delivery_addresses da ON o.delivery_address_id = da.id
  LEFT JOIN profiles p ON o.user_id = p.user_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Store resolved customer data
  v_resolved_customer_name := v_order_record.resolved_customer_name;
  v_resolved_customer_phone := v_order_record.resolved_customer_phone;

  -- Calculate distance
  v_distance_km := COALESCE(p_live_distance_km, v_order_record.distance_km, 0);
  
  -- Calculate payout
  v_payout_amount := GREATEST(25, v_distance_km * 8);
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'cod')) = 'COD' THEN 'pending'
    ELSE 'paid'
  END;

  -- Insert into delivery_history
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    customer_address,
    delivery_date,
    payout_amount,
    distance_km,
    payment_method,
    payment_status,
    status
  ) VALUES (
    p_order_id,
    p_agent_id,
    v_resolved_customer_name,
    v_resolved_customer_phone,
    v_order_record.customer_address,
    NOW(),
    v_payout_amount,
    v_distance_km,
    UPPER(COALESCE(p_payment_method, 'cod')),
    v_payment_status,
    'delivered'
  );

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents 
  SET 
    total_deliveries = total_deliveries + 1,
    total_earnings = total_earnings + v_payout_amount,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  -- Update agent earnings tracking
  UPDATE agent_earnings_tracking
  SET 
    payout_status = 'confirmed',
    actual_payout = v_payout_amount,
    completed_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate simple_mark_delivered with smart customer data fetching
CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text DEFAULT 'cod',
  p_live_distance_km numeric DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_order_record RECORD;
  v_distance_km numeric;
  v_payout_amount numeric;
  v_payment_status text;
  v_resolved_customer_name text;
  v_resolved_customer_phone text;
BEGIN
  -- Fetch order with customer data from multiple sources
  SELECT 
    o.*,
    COALESCE(o.customer_name, da.user_name, p.full_name, 'Unknown Customer') as resolved_customer_name,
    COALESCE(o.customer_phone, da.phone, p.phone, 'N/A') as resolved_customer_phone
  INTO v_order_record
  FROM orders o
  LEFT JOIN delivery_addresses da ON o.delivery_address_id = da.id
  LEFT JOIN profiles p ON o.user_id = p.user_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Store resolved customer data
  v_resolved_customer_name := v_order_record.resolved_customer_name;
  v_resolved_customer_phone := v_order_record.resolved_customer_phone;

  -- Calculate distance
  v_distance_km := COALESCE(p_live_distance_km, v_order_record.distance_km, 0);
  
  -- Calculate payout
  v_payout_amount := GREATEST(25, v_distance_km * 8);
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN UPPER(COALESCE(p_payment_method, 'cod')) = 'COD' THEN 'pending'
    ELSE 'paid'
  END;

  -- Insert into delivery_history
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    customer_address,
    delivery_date,
    payout_amount,
    distance_km,
    payment_method,
    payment_status,
    status
  ) VALUES (
    p_order_id,
    p_agent_id,
    v_resolved_customer_name,
    v_resolved_customer_phone,
    v_order_record.customer_address,
    NOW(),
    v_payout_amount,
    v_distance_km,
    UPPER(COALESCE(p_payment_method, 'cod')),
    v_payment_status,
    'delivered'
  );

  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents 
  SET 
    total_deliveries = total_deliveries + 1,
    total_earnings = total_earnings + v_payout_amount,
    last_delivery_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_payout_amount,
    'distance_km', v_distance_km
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;