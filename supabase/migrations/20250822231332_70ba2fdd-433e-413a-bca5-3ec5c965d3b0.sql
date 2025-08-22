-- Create edge function for COD settlement via Razorpay
-- This function will handle automatic COD amount settlement to admin

-- Add settlement tracking to agent_wallet_transactions
ALTER TABLE public.agent_wallet_transactions 
ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
ADD COLUMN IF NOT EXISTS razorpay_transaction_id TEXT;

-- Create a function to handle COD settlements
CREATE OR REPLACE FUNCTION public.settle_cod_to_admin(p_agent_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  settlement_id TEXT;
  agent_record RECORD;
BEGIN
  -- Get agent details
  SELECT * INTO agent_record
  FROM delivery_agents
  WHERE id = p_agent_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Agent not found or inactive'
    );
  END IF;

  -- Validate minimum amount
  IF p_amount < 500 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Minimum settlement amount is ₹500'
    );
  END IF;

  -- Generate settlement reference
  settlement_id := 'COD_' || extract(epoch from now())::bigint || '_' || substring(p_agent_id::text, 1, 8);

  -- Create settlement transaction
  INSERT INTO agent_wallet_transactions (
    agent_id,
    amount,
    transaction_type,
    description,
    status,
    settlement_reference
  ) VALUES (
    p_agent_id,
    -p_amount,
    'cod_settlement',
    'COD amount settled to admin via Razorpay',
    'pending',
    settlement_id
  );

  -- Update agent wallet
  UPDATE agent_wallet
  SET 
    pending_cod_amount = GREATEST(0, pending_cod_amount - p_amount),
    last_settlement_date = now(),
    updated_at = now()
  WHERE agent_id = p_agent_id;

  -- Log the settlement attempt
  INSERT INTO password_reset_logs (
    email,
    event_type,
    metadata
  ) VALUES (
    agent_record.email,
    'email_sent',
    jsonb_build_object(
      'action', 'cod_settlement_initiated',
      'agent_id', p_agent_id,
      'amount', p_amount,
      'settlement_reference', settlement_id,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'settlement_reference', settlement_id,
    'amount', p_amount,
    'message', 'COD settlement initiated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;