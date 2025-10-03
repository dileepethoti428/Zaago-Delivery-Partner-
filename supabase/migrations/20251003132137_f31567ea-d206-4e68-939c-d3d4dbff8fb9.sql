-- Fix NULL handling in qr_complete_delivery_v3
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION qr_complete_delivery_v3(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_amount NUMERIC := 30.00;
  v_payment_status TEXT;
  v_order RECORD;
  v_existing_delivery UUID;
  v_earning_id UUID;
  v_delivery_duration INTEGER;
BEGIN
  -- Log function start
  INSERT INTO password_reset_logs (email, event_type, metadata)
  VALUES ('system@zaago.com', 'email_sent', jsonb_build_object(
    'action', 'qr_complete_v3_started',
    'order_id', p_order_id,
    'agent_id', p_agent_id,
    'payment_method', p_payment_method,
    'timestamp', NOW()
  ));
  
  -- Validate inputs
  IF p_order_id IS NULL OR p_agent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid order_id or agent_id');
  END IF;
  
  -- STEP 1: Early duplicate check
  SELECT id INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF v_existing_delivery IS NOT NULL THEN
    INSERT INTO password_reset_logs (email, event_type, metadata)
    VALUES ('system@zaago.com', 'email_sent', jsonb_build_object(
      'action', 'qr_complete_v3_duplicate_detected',
      'order_id', p_order_id,
      'agent_id', p_agent_id,
      'existing_delivery_id', v_existing_delivery
    ));
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'already_completed', true,
      'order_id', p_order_id,
      'delivery_id', v_existing_delivery
    );
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if already delivered
  IF v_order.status = 'delivered' AND v_order.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already marked as delivered',
      'already_completed', true,
      'order_id', p_order_id
    );
  END IF;
  
  -- Verify agent assignment
  IF v_order.agent_id != p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not assigned to this agent');
  END IF;
  
  -- Determine payment status
  v_payment_status := CASE WHEN p_payment_method = 'COD' THEN 'paid_cod' ELSE 'paid_online' END;
  
  -- Calculate delivery duration safely
  v_delivery_duration := COALESCE(
    EXTRACT(EPOCH FROM (NOW() - v_order.created_at))::INTEGER,
    0
  );
  
  -- STEP 2: Create delivery_history with explicit values
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
    completed_at,
    delivery_payout,
    delivery_duration,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_agent_id,
    COALESCE(v_order.customer_name, 'Unknown'),
    COALESCE(v_order.customer_phone, 'N/A'),
    COALESCE(v_order.address, '{}'::jsonb),
    COALESCE(v_order.items, '[]'::jsonb),
    COALESCE(v_order.total, 0),
    p_payment_method,
    v_payment_status,
    CURRENT_DATE,
    NOW(),
    v_payout_amount,
    v_delivery_duration,
    NOW(),
    NOW()
  )
  ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;
  
  -- STEP 3: Update order to delivered
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered = true,
    delivered_at = NOW(),
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update order');
  END IF;
  
  -- STEP 4: Create earnings record
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'completed',
    'QR Delivery completed - ₹' || v_payout_amount
  )
  ON CONFLICT (agent_id, order_id) DO NOTHING
  RETURNING id INTO v_earning_id;
  
  -- STEP 5: Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();
  
  -- STEP 6: Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'delivery_payment',
    'QR Delivery payout'
  )
  ON CONFLICT (agent_id, order_id) DO NOTHING;
  
  -- Log success
  INSERT INTO password_reset_logs (email, event_type, metadata)
  VALUES ('system@zaago.com', 'email_sent', jsonb_build_object(
    'action', 'qr_complete_v3_success',
    'order_id', p_order_id,
    'agent_id', p_agent_id,
    'payout_amount', v_payout_amount
  ));
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout_amount,
    'payment_method', p_payment_method,
    'payment_status', v_payment_status,
    'earning_id', v_earning_id,
    'delivered_at', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  INSERT INTO password_reset_logs (email, event_type, metadata, error)
  VALUES ('system@zaago.com', 'email_sent', jsonb_build_object(
    'action', 'qr_complete_v3_error',
    'order_id', p_order_id,
    'agent_id', p_agent_id
  ), SQLERRM);
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error during delivery completion',
    'details', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION qr_complete_delivery_v3 IS 'QR delivery completion with NULL-safe value handling and explicit timestamp columns';