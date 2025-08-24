-- Create function to automatically settle COD amounts from agent wallet to admin
CREATE OR REPLACE FUNCTION public.settle_cod_automatically(
  p_agent_id uuid,
  p_order_id uuid,
  p_cod_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settlement_reference text;
  v_current_balance numeric;
  v_result jsonb;
BEGIN
  -- Generate settlement reference
  v_settlement_reference := 'COD_' || p_order_id::text || '_' || extract(epoch from now())::bigint;
  
  -- Get current agent wallet balance
  SELECT balance INTO v_current_balance
  FROM agent_wallet
  WHERE agent_id = p_agent_id;
  
  -- If no wallet exists, create one
  IF v_current_balance IS NULL THEN
    INSERT INTO agent_wallet (agent_id, balance, pending_cod_amount)
    VALUES (p_agent_id, 0, 0);
    v_current_balance := 0;
  END IF;
  
  -- Check if agent has sufficient balance for COD settlement
  IF v_current_balance < p_cod_amount THEN
    -- If insufficient balance, just track as pending COD
    UPDATE agent_wallet 
    SET 
      pending_cod_amount = pending_cod_amount + p_cod_amount,
      total_collected = total_collected + p_cod_amount,
      updated_at = now()
    WHERE agent_id = p_agent_id;
    
    -- Create transaction for COD collection (pending settlement)
    INSERT INTO agent_wallet_transactions (
      agent_id,
      order_id,
      transaction_type,
      amount,
      description,
      status,
      settlement_reference
    ) VALUES (
      p_agent_id,
      p_order_id,
      'cod_collection',
      p_cod_amount,
      'COD amount collected - pending settlement due to insufficient wallet balance',
      'pending',
      v_settlement_reference
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'cod_pending',
      'settlement_reference', v_settlement_reference,
      'message', 'COD amount added to pending - insufficient wallet balance for immediate settlement',
      'pending_amount', p_cod_amount
    );
  ELSE
    -- Sufficient balance - automatically settle COD
    UPDATE agent_wallet 
    SET 
      balance = balance - p_cod_amount,
      total_collected = total_collected + p_cod_amount,
      updated_at = now()
    WHERE agent_id = p_agent_id;
    
    -- Create transaction for COD collection
    INSERT INTO agent_wallet_transactions (
      agent_id,
      order_id,
      transaction_type,
      amount,
      description,
      status,
      settlement_reference
    ) VALUES (
      p_agent_id,
      p_order_id,
      'cod_collection',
      p_cod_amount,
      'COD amount collected from customer',
      'completed',
      v_settlement_reference || '_collection'
    );
    
    -- Create transaction for COD settlement to admin
    INSERT INTO agent_wallet_transactions (
      agent_id,
      order_id,
      transaction_type,
      amount,
      description,
      status,
      settlement_reference
    ) VALUES (
      p_agent_id,
      p_order_id,
      'cod_settlement',
      -p_cod_amount,  -- Negative amount as it's going out
      'COD amount automatically settled to admin',
      'completed',
      v_settlement_reference || '_settlement'
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'cod_settled',
      'settlement_reference', v_settlement_reference,
      'message', 'COD amount automatically settled to admin',
      'settled_amount', p_cod_amount,
      'remaining_balance', v_current_balance - p_cod_amount
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  -- Log error and return failure
  INSERT INTO password_reset_logs (
    email,
    event_type,
    metadata,
    error
  ) VALUES (
    'system@zaago.com',
    'email_sent',
    jsonb_build_object(
      'action', 'cod_auto_settlement_failed',
      'agent_id', p_agent_id,
      'order_id', p_order_id,
      'cod_amount', p_cod_amount
    ),
    SQLERRM
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'COD settlement failed: ' || SQLERRM
  );
END;
$$;