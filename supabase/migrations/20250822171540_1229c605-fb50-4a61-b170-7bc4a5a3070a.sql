-- Fix agent_wallet_transactions constraint to allow delivery-related transaction types
ALTER TABLE agent_wallet_transactions DROP CONSTRAINT IF EXISTS agent_wallet_transactions_transaction_type_check;
ALTER TABLE agent_wallet_transactions ADD CONSTRAINT agent_wallet_transactions_transaction_type_check 
CHECK (transaction_type IN ('earning', 'withdrawal', 'cod_settlement', 'delivery_payment', 'peak_bonus', 'bonus', 'deduction', 'adjustment'));

-- Add index for idempotency checks on agent transactions (without CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_agent_wallet_transactions_agent_order 
ON agent_wallet_transactions(agent_id, order_id, transaction_type) 
WHERE order_id IS NOT NULL;

-- Create safe payout processing function that won't block delivery completion
CREATE OR REPLACE FUNCTION public.process_delivery_payout_safe(
  p_agent_id UUID,
  p_order_id UUID,
  p_distance_km NUMERIC DEFAULT 0,
  p_delivery_time TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payout_result JSONB;
  existing_earning UUID;
BEGIN
  -- Check if earning already exists for this order (idempotency)
  SELECT id INTO existing_earning
  FROM earnings 
  WHERE agent_id = p_agent_id AND order_id = p_order_id;
  
  IF existing_earning IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payout already processed',
      'earning_id', existing_earning
    );
  END IF;
  
  -- Calculate payout
  SELECT calculate_delivery_payout(p_distance_km, p_delivery_time, p_agent_id) INTO payout_result;
  
  -- Insert earning record
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (
    p_agent_id,
    p_order_id,
    (payout_result->>'total_payout')::NUMERIC,
    'completed',
    'Delivery payout: ' || p_distance_km || 'km'
  )
  RETURNING id INTO existing_earning;
  
  -- Update agent wallet safely
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, (payout_result->>'total_payout')::NUMERIC, now())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + (payout_result->>'total_payout')::NUMERIC,
    updated_at = now();
  
  -- Create wallet transaction
  INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
  VALUES (
    p_agent_id,
    p_order_id,
    (payout_result->>'total_payout')::NUMERIC,
    'delivery_payment',
    'Delivery payout for order'
  );
  
  -- Add peak bonus if applicable
  IF (payout_result->>'peak_bonus')::NUMERIC > 0 THEN
    INSERT INTO agent_wallet_transactions (agent_id, order_id, amount, transaction_type, description)
    VALUES (
      p_agent_id,
      p_order_id,
      (payout_result->>'peak_bonus')::NUMERIC,
      'peak_bonus',
      'Peak hour bonus'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_details', payout_result,
    'earning_id', existing_earning
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the delivery completion
  INSERT INTO password_reset_logs (
    email,
    event_type,
    metadata,
    error
  ) VALUES (
    'system@zaago.com',
    'email_sent',
    jsonb_build_object(
      'action', 'payout_processing_failed',
      'agent_id', p_agent_id,
      'order_id', p_order_id,
      'distance_km', p_distance_km
    ),
    SQLERRM
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Payout processing failed but delivery completed',
    'details', SQLERRM
  );
END;
$function$;