-- Create a safe wallet transaction function to prevent null amount errors
CREATE OR REPLACE FUNCTION public.complete_delivery_simple(
  p_order_id UUID,
  p_agent_id UUID,
  p_payout_amount NUMERIC DEFAULT 35,
  p_distance_km NUMERIC DEFAULT 2.5,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  safe_payout_amount NUMERIC;
  safe_distance_km NUMERIC;
BEGIN
  -- Ensure safe values (never null or zero)
  safe_payout_amount := GREATEST(COALESCE(p_payout_amount, 35), 20);
  safe_distance_km := GREATEST(COALESCE(p_distance_km, 2.5), 0.1);
  
  -- Update order status
  UPDATE orders 
  SET 
    status = 'delivered',
    payment_status = CASE 
      WHEN UPPER(p_payment_method) = 'COD' THEN 'paid_cod' 
      ELSE 'paid_online' 
    END,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id 
    AND agent_id = p_agent_id;
    
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or agent not authorized'
    );
  END IF;
  
  -- Create earnings record safely (only if doesn't exist)
  INSERT INTO earnings (
    agent_id, 
    order_id, 
    amount, 
    status, 
    distance_km, 
    payment_method,
    description
  ) 
  SELECT 
    p_agent_id,
    p_order_id,
    safe_payout_amount,
    'completed',
    safe_distance_km,
    CASE WHEN UPPER(p_payment_method) = 'COD' THEN 'COD' ELSE 'Online' END,
    'Delivery payout for order ' || LEFT(p_order_id::text, 8)
  WHERE NOT EXISTS (
    SELECT 1 FROM earnings 
    WHERE agent_id = p_agent_id AND order_id = p_order_id
  );
  
  -- Update agent stats safely
  UPDATE delivery_agents 
  SET 
    total_deliveries = COALESCE(total_deliveries, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + safe_payout_amount,
    last_delivery_at = NOW(),
    updated_at = NOW()
  WHERE id = p_agent_id;
  
  -- Create wallet transaction with guaranteed amount
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
    safe_payout_amount,
    'delivery_payment',
    'Delivery payout',
    'completed'
  ) ON CONFLICT (agent_id, order_id, transaction_type) DO NOTHING;
  
  -- Update wallet balance safely
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, safe_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + safe_payout_amount,
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_amount', safe_payout_amount,
    'distance_km', safe_distance_km,
    'message', 'Delivery completed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database operation failed',
    'details', SQLERRM
  );
END;
$$;