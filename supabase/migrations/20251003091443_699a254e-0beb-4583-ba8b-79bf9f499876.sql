-- Create safe QR delivery completion function that bypasses triggers
CREATE OR REPLACE FUNCTION public.complete_qr_delivery_safe(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_payment_status TEXT;
  v_payout_amount NUMERIC := 30; -- Fixed ₹30 payout
  v_result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND agent_id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or not assigned to this agent'
    );
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent
  FROM delivery_agents
  WHERE id = p_agent_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agent not found or inactive'
    );
  END IF;
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN p_payment_method = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;
  
  -- Disable triggers temporarily
  SET session_replication_role = 'replica';
  
  BEGIN
    -- Update order status
    UPDATE orders
    SET 
      status = 'delivered',
      delivered_at = NOW(),
      payment_status = v_payment_status,
      updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create earnings record (idempotent check)
    INSERT INTO earnings (agent_id, order_id, amount, status, description, distance_km)
    VALUES (
      p_agent_id,
      p_order_id,
      v_payout_amount,
      'completed',
      'QR delivery completion',
      2.5
    )
    ON CONFLICT (agent_id, order_id) DO NOTHING;
    
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
      'QR delivery payout',
      'completed'
    );
    
    -- Create delivery history
    INSERT INTO delivery_history (
      order_id,
      agent_id,
      customer_name,
      customer_phone,
      delivery_address,
      items,
      total_amount,
      payment_status,
      payment_method,
      delivery_date,
      delivery_time_slot,
      special_instructions,
      completed_at,
      delivery_payout,
      distance_traveled
    ) VALUES (
      p_order_id,
      p_agent_id,
      COALESCE((v_order.address->>'fullName')::text, 'Customer'),
      COALESCE((v_order.address->>'phone')::text, ''),
      v_order.address,
      v_order.items,
      v_order.total,
      v_payment_status,
      p_payment_method,
      CURRENT_DATE,
      v_order.delivery_time_slot,
      v_order.special_instructions,
      NOW(),
      v_payout_amount,
      2.5
    )
    ON CONFLICT (order_id) DO NOTHING;
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
    
    v_result := jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'agent_name', v_agent.name,
      'payout_amount', v_payout_amount,
      'payment_method', p_payment_method,
      'payment_status', v_payment_status
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Re-enable triggers on error
    SET session_replication_role = DEFAULT;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery completion failed',
      'details', SQLERRM
    );
  END;
END;
$$;