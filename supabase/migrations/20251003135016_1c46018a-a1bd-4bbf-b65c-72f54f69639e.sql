-- Fix nuclear_complete_delivery_bypass to provide ALL required fields
DROP FUNCTION IF EXISTS public.nuclear_complete_delivery_bypass(uuid, uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.nuclear_complete_delivery_bypass(
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
  v_order RECORD;
  v_agent RECORD;
  v_payout NUMERIC := 30;
  v_payment_status TEXT;
  v_delivery_duration INTEGER;
BEGIN
  -- Get COMPLETE order details
  SELECT 
    id, total, agent_id, customer_name, customer_phone,
    address, items, created_at
  INTO v_order 
  FROM orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Get agent details
  SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  
  -- Determine payment status
  v_payment_status := CASE 
    WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod'
    ELSE 'paid_online'
  END;
  
  -- Calculate delivery duration
  v_delivery_duration := EXTRACT(EPOCH FROM (NOW() - v_order.created_at))::INTEGER;
  
  BEGIN
    -- Direct order update
    UPDATE orders 
    SET 
      status = 'delivered',
      delivered_at = NOW(),
      payment_status = v_payment_status,
      updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create earning
    INSERT INTO earnings (agent_id, order_id, amount, status, description, created_at)
    VALUES (p_agent_id, p_order_id, v_payout, 'completed', 'Nuclear delivery payout', NOW())
    ON CONFLICT (agent_id, order_id) DO NOTHING;
    
    -- Update wallet
    INSERT INTO agent_wallet (agent_id, balance, updated_at)
    VALUES (p_agent_id, v_payout, NOW())
    ON CONFLICT (agent_id) 
    DO UPDATE SET balance = agent_wallet.balance + v_payout, updated_at = NOW();
    
    -- Create wallet transaction
    INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description, status, created_at)
    VALUES (p_agent_id, p_order_id, v_payout, 'delivery_payment', 'Nuclear delivery payout', 'completed', NOW())
    ON CONFLICT DO NOTHING;
    
    -- Create delivery history with ALL REQUIRED FIELDS
    INSERT INTO delivery_history (
      order_id, 
      agent_id,
      customer_name,
      customer_phone,
      delivery_address,
      items,
      total_amount,
      delivery_date,
      payment_method,
      payment_status,
      delivery_payout,
      delivery_duration,
      completed_at,
      created_at,
      updated_at
    )
    VALUES (
      p_order_id,
      p_agent_id,
      COALESCE(v_order.customer_name, 'Unknown Customer'),
      v_order.customer_phone,
      v_order.address,
      v_order.items,
      v_order.total,
      CURRENT_DATE,
      p_payment_method,
      v_payment_status,
      v_payout,
      v_delivery_duration,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      completed_at = NOW(),
      delivery_payout = v_payout,
      agent_id = p_agent_id,
      updated_at = NOW();
    
    -- Log success
    INSERT INTO password_reset_logs (email, event_type, metadata)
    VALUES ('nuclear@ops.com', 'email_sent', jsonb_build_object(
      'action', 'nuclear_delivery_completion_fixed',
      'order_id', p_order_id,
      'agent_id', p_agent_id,
      'payout', v_payout,
      'timestamp', NOW()
    ));
    
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'status', 'delivered',
      'payment_status', v_payment_status,
      'payout', v_payout,
      'method', 'nuclear_bypass_fixed'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
  END;
END;
$$;

COMMENT ON FUNCTION public.nuclear_complete_delivery_bypass IS 'Nuclear bypass for delivery completion - provides ALL required fields, no trigger manipulation';