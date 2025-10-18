-- Drop and recreate qr_complete_delivery_v3 with correct field references
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_order_id UUID,
  p_payment_method TEXT,
  p_agent_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_result JSONB;
BEGIN
  -- Get order details with correct field name
  SELECT 
    id, status, agent_id, user_id, total, items, 
    address, payment_status, customer_name, customer_phone
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;

  -- Update order status to delivered
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = CASE 
      WHEN p_payment_method = 'COD' THEN 'pending'
      ELSE 'paid'
    END,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert into delivery_history with correct field name (address, not delivery_address)
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
    delivery_date,
    completed_at
  ) VALUES (
    v_order.id,
    p_agent_id,
    v_order.customer_name,
    v_order.customer_phone,
    v_order.address,  -- Changed from delivery_address to address
    v_order.items,
    v_order.total,
    p_payment_method,
    CASE WHEN p_payment_method = 'COD' THEN 'pending' ELSE 'paid' END,
    CURRENT_DATE,
    NOW()
  );

  -- Update agent stats
  UPDATE delivery_agents
  SET 
    total_deliveries = total_deliveries + 1,
    deliveries_today = deliveries_today + 1,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', v_order.id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix manual_complete_delivery function
DROP FUNCTION IF EXISTS manual_complete_delivery(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION manual_complete_delivery(
  p_order_id UUID,
  p_payment_method TEXT,
  p_agent_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    id, status, agent_id, user_id, total, items,
    address, payment_status, customer_name, customer_phone
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = CASE WHEN p_payment_method = 'COD' THEN 'pending' ELSE 'paid' END,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, delivery_date, completed_at
  ) VALUES (
    v_order.id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address,  -- Fixed: was delivery_address, now address
    v_order.items, v_order.total, p_payment_method,
    CASE WHEN p_payment_method = 'COD' THEN 'pending' ELSE 'paid' END,
    CURRENT_DATE, NOW()
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order.id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix simple_mark_delivered function
DROP FUNCTION IF EXISTS simple_mark_delivered(UUID, UUID);

CREATE OR REPLACE FUNCTION simple_mark_delivered(
  p_order_id UUID,
  p_agent_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    id, status, agent_id, user_id, total, items,
    address, payment_status, customer_name, customer_phone
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone,
    delivery_address, items, total_amount, payment_method,
    payment_status, delivery_date, completed_at
  ) VALUES (
    v_order.id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address,  -- Fixed: was delivery_address, now address
    v_order.items, v_order.total, 'ONLINE',
    v_order.payment_status, CURRENT_DATE, NOW()
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order.id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;