-- Restore the fully working QR delivery completion function
DROP FUNCTION IF EXISTS qr_complete_delivery_v2(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION qr_complete_delivery_v2(
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
  v_earning_id UUID;
  v_order RECORD;
BEGIN
  -- Validate inputs
  IF p_order_id IS NULL OR p_agent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid order_id or agent_id');
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if already delivered (idempotency)
  IF v_order.status = 'delivered' AND v_order.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
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
  
  -- BEGIN ATOMIC OPERATIONS
  
  -- 1. Update order to delivered
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
  
  -- 2. Create earnings record (idempotent)
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
  
  -- 3. Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount,
    updated_at = NOW();
  
  -- 4. Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, description
  ) VALUES (
    p_agent_id,
    p_order_id,
    v_payout_amount,
    'delivery_payment',
    'QR Delivery payout'
  );
  
  -- Return success with all details
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
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error during delivery completion',
    'details', SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION qr_complete_delivery_v2 IS 'Complete QR delivery with full business logic: order update, earnings, wallet, transactions';