-- Add distance_km column to orders table if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;

-- Create complete_delivery_zepto function - single source of truth for payout calculation
CREATE OR REPLACE FUNCTION complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'COD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_distance_km NUMERIC;
  v_base_pay NUMERIC := 10;
  v_rate_per_km NUMERIC := 8;
  v_distance_pay NUMERIC;
  v_total_payout NUMERIC;
  v_payment_status TEXT;
  v_payout_breakdown JSONB;
BEGIN
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
  
  -- Check if already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'payout_amount', 0
    );
  END IF;
  
  -- Get distance (default to 2.5km if not set)
  v_distance_km := COALESCE(v_order.distance_km, 2.5);
  
  -- Round UP to 1 decimal (Zepto style)
  v_distance_km := CEIL(v_distance_km * 10) / 10;
  
  -- Calculate payout: base_pay + (distance_km * rate_per_km)
  v_distance_pay := v_distance_km * v_rate_per_km;
  v_total_payout := v_base_pay + v_distance_pay;
  
  -- Round to 1 decimal
  v_total_payout := ROUND(v_total_payout::NUMERIC, 1);
  v_distance_pay := ROUND(v_distance_pay::NUMERIC, 1);
  
  -- Build breakdown
  v_payout_breakdown := jsonb_build_object(
    'base_pay', v_base_pay,
    'rate_per_km', v_rate_per_km,
    'distance_km', v_distance_km,
    'distance_pay', v_distance_pay
  );
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid'
    ELSE 'collected'
  END;
  
  -- Update order status
  UPDATE orders SET
    status = 'delivered',
    delivered = true,
    delivered_at = NOW(),
    payment_status = v_payment_status,
    delivery_payout = v_total_payout,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Insert/Update agent_earnings_tracking
  INSERT INTO agent_earnings_tracking (
    order_id,
    agent_id,
    accepted_at,
    completed_at,
    distance_km,
    expected_payout,
    actual_payout,
    payout_status,
    payout_breakdown,
    payment_method,
    order_type
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.accepted_at, NOW()),
    NOW(),
    v_distance_km,
    v_total_payout,
    v_total_payout,
    'confirmed',
    v_payout_breakdown,
    UPPER(p_payment_method),
    'regular'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    completed_at = NOW(),
    distance_km = EXCLUDED.distance_km,
    actual_payout = EXCLUDED.actual_payout,
    payout_status = 'confirmed',
    payout_breakdown = EXCLUDED.payout_breakdown,
    payment_method = EXCLUDED.payment_method,
    updated_at = NOW();
  
  -- Insert delivery_history
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
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    v_order.customer_phone,
    COALESCE(v_order.address::jsonb, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    UPPER(p_payment_method),
    v_payment_status,
    v_total_payout,
    v_distance_km,
    NOW(),
    CURRENT_DATE
  );
  
  -- Update agent stats
  UPDATE delivery_agents SET
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_total_payout,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;
  
  -- Return success with payout details
  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', v_total_payout,
    'distance_km', v_distance_km,
    'payout_breakdown', v_payout_breakdown
  );
END;
$$;