-- Create a safe wrapper function that catches ALL exceptions
CREATE OR REPLACE FUNCTION public.complete_delivery_safe_wrapper(
  p_order_id UUID,
  p_agent_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Wrap everything in a nested block to catch ALL exceptions
  BEGIN
    -- Check if already completed (idempotency check)
    IF EXISTS (
      SELECT 1 FROM delivery_completions 
      WHERE order_id = p_order_id AND status = 'completed'
    ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery already completed',
        'order_id', p_order_id
      );
    END IF;

    -- Update order status
    UPDATE orders 
    SET 
      status = 'delivered',
      delivered_at = now(),
      payment_status = CASE 
        WHEN p_payment_method IN ('ONLINE', 'online', 'paid_online') THEN 'paid'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = p_order_id;

    -- Insert delivery completion record (with ON CONFLICT)
    INSERT INTO delivery_completions (
      order_id,
      agent_id,
      payment_method,
      completed_at,
      status,
      payout_amount
    ) VALUES (
      p_order_id,
      p_agent_id,
      p_payment_method,
      now(),
      'completed',
      30
    )
    ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;

    -- Create/update delivery history
    INSERT INTO delivery_history (
      order_id,
      agent_id,
      completed_at,
      payment_method,
      payment_status,
      delivery_payout,
      customer_name,
      delivery_address,
      items,
      total_amount
    )
    SELECT 
      o.id,
      p_agent_id,
      now(),
      p_payment_method,
      o.payment_status,
      30,
      COALESCE((o.delivery_address->>'user_name')::TEXT, 'Customer'),
      o.delivery_address,
      o.items,
      o.total
    FROM orders o
    WHERE o.id = p_order_id
    ON CONFLICT (order_id) DO UPDATE SET
      completed_at = now(),
      payment_method = EXCLUDED.payment_method,
      payment_status = EXCLUDED.payment_status,
      updated_at = now();

    -- Create/update earning record
    INSERT INTO earnings (
      agent_id,
      order_id,
      amount,
      status,
      description
    ) VALUES (
      p_agent_id,
      p_order_id,
      30,
      'completed',
      'Delivery payout'
    )
    ON CONFLICT (agent_id, order_id) DO NOTHING;

    -- Update agent wallet
    INSERT INTO agent_wallet (agent_id, balance)
    VALUES (p_agent_id, 30)
    ON CONFLICT (agent_id) DO UPDATE SET
      balance = agent_wallet.balance + 30,
      updated_at = now();

    -- Create wallet transaction (only if not exists)
    INSERT INTO agent_wallet_transactions (
      agent_id,
      order_id,
      amount,
      transaction_type,
      description
    )
    SELECT p_agent_id, p_order_id, 30, 'delivery_payment', 'Delivery payout'
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_wallet_transactions 
      WHERE agent_id = p_agent_id 
      AND order_id = p_order_id 
      AND transaction_type = 'delivery_payment'
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery completed successfully',
      'order_id', p_order_id
    );

  EXCEPTION 
    WHEN unique_violation THEN
      -- Duplicate detected - this means it's already completed
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery already completed',
        'order_id', p_order_id
      );
    WHEN OTHERS THEN
      -- Any other error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'order_id', p_order_id
      );
  END;
END;
$$;