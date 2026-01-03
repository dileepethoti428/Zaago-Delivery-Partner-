-- Drop existing function first (required to change return type)
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(UUID, UUID, TEXT);

-- Recreate with backwards-compatible agent check (both assigned_agent_id OR legacy agent_id)
CREATE OR REPLACE FUNCTION public.complete_delivery_zepto(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'prepaid'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payout NUMERIC;
  v_distance NUMERIC;
  v_base_pay NUMERIC := 25;
  v_per_km_rate NUMERIC := 8;
  v_cod_amount NUMERIC := 0;
  v_result JSON;
BEGIN
  -- Get order with backwards-compatible agent check (both assigned_agent_id OR legacy agent_id)
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND (assigned_agent_id = p_agent_id OR agent_id = p_agent_id)
    AND status IN ('assigned', 'out_for_delivery', 'picked_up');

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found or not assigned to this agent';
  END IF;

  -- Get agent details
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id;

  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  -- Calculate distance and payout
  v_distance := COALESCE(v_order.distance_km, 2);
  v_payout := v_base_pay + (v_distance * v_per_km_rate);

  -- Handle COD
  IF p_payment_method = 'cod' THEN
    v_cod_amount := COALESCE(v_order.total_amount, 0);
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_method = p_payment_method,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + v_payout,
    last_delivery_at = NOW(),
    deliveries_today = COALESCE(deliveries_today, 0) + 1,
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Update earnings tracking
  UPDATE agent_earnings_tracking
  SET 
    payout_status = 'completed',
    actual_payout = v_payout,
    completed_at = NOW(),
    payment_method = p_payment_method,
    distance_km = v_distance,
    updated_at = NOW()
  WHERE order_id = p_order_id AND agent_id = p_agent_id;

  -- Insert delivery history
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
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
    COALESCE(v_order.customer_name, 'Customer'),
    COALESCE(v_order.delivery_address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total_amount, 0),
    p_payment_method,
    'completed',
    v_payout,
    v_distance,
    NOW(),
    CURRENT_DATE
  );

  -- Build result
  v_result := json_build_object(
    'success', true,
    'payout', v_payout,
    'distance_km', v_distance,
    'cod_amount', v_cod_amount,
    'order_id', p_order_id
  );

  RETURN v_result;
END;
$$;