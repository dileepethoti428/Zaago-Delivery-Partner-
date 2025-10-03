-- Create function to validate if order is completion-ready
CREATE OR REPLACE FUNCTION validate_order_for_completion(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_missing_fields TEXT[] := '{}';
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check required fields
  IF v_order.customer_name IS NULL OR v_order.customer_name = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'customer_name');
  END IF;
  
  IF v_order.customer_phone IS NULL OR v_order.customer_phone = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'customer_phone');
  END IF;
  
  IF v_order.address IS NULL OR v_order.address = '{}'::jsonb THEN
    v_missing_fields := array_append(v_missing_fields, 'address');
  END IF;
  
  IF v_order.items IS NULL OR v_order.items = '[]'::jsonb THEN
    v_missing_fields := array_append(v_missing_fields, 'items');
  END IF;
  
  IF v_order.total IS NULL OR v_order.total = 0 THEN
    v_missing_fields := array_append(v_missing_fields, 'total');
  END IF;
  
  IF v_order.created_at IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'created_at');
  END IF;
  
  -- Return validation result
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Order has missing required fields',
      'missing_fields', v_missing_fields,
      'order_id', p_order_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'order_id', p_order_id,
    'message', 'Order is ready for completion'
  );
END;
$$;

-- Update qr_complete_delivery_v3 with validation
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
  v_validation_result JSONB;
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
  
  -- STEP 1: Validate order is completion-ready
  SELECT validate_order_for_completion(p_order_id) INTO v_validation_result;
  
  IF NOT (v_validation_result->>'valid')::boolean THEN
    INSERT INTO password_reset_logs (email, event_type, metadata)
    VALUES ('system@zaago.com', 'email_sent', jsonb_build_object(
      'action', 'qr_complete_v3_validation_failed',
      'order_id', p_order_id,
      'validation_error', v_validation_result
    ));
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order validation failed',
      'details', v_validation_result
    );
  END IF;
  
  -- STEP 2: Early duplicate check
  SELECT id INTO v_existing_delivery
  FROM delivery_history
  WHERE order_id = p_order_id AND agent_id = p_agent_id;
  
  IF v_existing_delivery IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Delivery already completed',
      'already_completed', true,
      'order_id', p_order_id,
      'delivery_id', v_existing_delivery
    );
  END IF;
  
  -- Get order details (we know it's valid now)
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
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
  
  -- Calculate delivery duration safely (we know created_at is not NULL)
  v_delivery_duration := EXTRACT(EPOCH FROM (NOW() - v_order.created_at))::INTEGER;
  
  -- STEP 3: Create delivery_history (data is already validated)
  INSERT INTO delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_method, payment_status, delivery_date,
    completed_at, delivery_payout, delivery_duration, created_at, updated_at
  ) VALUES (
    p_order_id, p_agent_id, v_order.customer_name, v_order.customer_phone,
    v_order.address, v_order.items, v_order.total, p_payment_method,
    v_payment_status, CURRENT_DATE, NOW(), v_payout_amount,
    v_delivery_duration, NOW(), NOW()
  )
  ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;
  
  -- STEP 4: Update order to delivered
  UPDATE orders 
  SET status = 'delivered', delivered = true, delivered_at = NOW(),
      payment_status = v_payment_status, updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;
    
  -- STEP 5: Create earnings record
  INSERT INTO earnings (agent_id, order_id, amount, status, description)
  VALUES (p_agent_id, p_order_id, v_payout_amount, 'completed',
          'QR Delivery completed - ₹' || v_payout_amount)
  ON CONFLICT (agent_id, order_id) DO NOTHING
  RETURNING id INTO v_earning_id;
  
  -- STEP 6: Update agent wallet
  INSERT INTO agent_wallet (agent_id, balance, updated_at)
  VALUES (p_agent_id, v_payout_amount, NOW())
  ON CONFLICT (agent_id) DO UPDATE SET
    balance = agent_wallet.balance + v_payout_amount, updated_at = NOW();
  
  -- STEP 7: Create wallet transaction
  INSERT INTO agent_wallet_transactions (
    agent_id, order_id, amount, transaction_type, description
  ) VALUES (
    p_agent_id, p_order_id, v_payout_amount, 'delivery_payment', 'QR Delivery payout'
  ) ON CONFLICT (agent_id, order_id) DO NOTHING;
  
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

-- Update notify_agents_on_packed_order trigger to validate orders
CREATE OR REPLACE FUNCTION notify_agents_on_packed_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation_result JSONB;
BEGIN
  -- Only trigger if status changed to 'packed' and order is unassigned
  IF NEW.status = 'packed' AND OLD.status != 'packed' AND NEW.agent_id IS NULL THEN
    
    -- Validate order before notifying
    SELECT validate_order_for_completion(NEW.id) INTO v_validation_result;
    
    IF NOT (v_validation_result->>'valid')::boolean THEN
      -- Log validation failure instead of notifying
      INSERT INTO password_reset_logs (
        email, event_type, metadata
      ) VALUES (
        'system@zaago.com',
        'email_sent',
        jsonb_build_object(
          'action', 'notification_skipped_invalid_order',
          'order_id', NEW.id,
          'status', NEW.status,
          'validation_error', v_validation_result,
          'timestamp', now()
        )
      );
      
      RETURN NEW;
    END IF;
    
    -- Order is valid, proceed with notification
    PERFORM net.http_post(
      url := 'https://amhpjsmubciahslghobw.supabase.co/functions/v1/notify-delivery-agents',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaHBqc211YmNpYWhzbGdob2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzAxNjksImV4cCI6MjA3MTEwNjE2OX0.QtKx2Nvm0MkIgJUXSoUxQH20l7W-UyzdVInVps_z70Y'
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total
      )
    );
    
    -- Log successful notification trigger
    INSERT INTO password_reset_logs (
      email, event_type, metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'auto_notify_agents_triggered',
        'order_id', NEW.id,
        'status', NEW.status,
        'triggered_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_order_for_completion IS 'Validates if an order has all required fields for delivery completion';
COMMENT ON FUNCTION qr_complete_delivery_v3 IS 'QR delivery completion with order validation and NULL-safe handling';