-- FINAL FIX: Remove all references to non-existent latitude/longitude columns
-- This fixes both qr_complete_delivery_atomic() and create_delivery_history_entry()

-- Step 1: Fix create_delivery_history_entry trigger function
DROP TRIGGER IF EXISTS after_order_delivered ON orders;
DROP FUNCTION IF EXISTS create_delivery_history_entry() CASCADE;

CREATE OR REPLACE FUNCTION create_delivery_history_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_payment_method TEXT;
BEGIN
  IF NEW.status = 'delivered' AND NEW.agent_id IS NOT NULL THEN
    
    -- Derive payment_method from payment_status
    derived_payment_method := CASE 
      WHEN NEW.payment_status = 'paid_cod' THEN 'COD'
      WHEN NEW.payment_status = 'paid_online' THEN 'Online'
      ELSE 'Online'
    END;
    
    -- Insert into delivery_history WITHOUT agent location (no latitude/longitude columns exist)
    INSERT INTO delivery_history (
      order_id, agent_id, customer_name, customer_phone,
      delivery_address, items, total_amount, payment_status,
      payment_method, delivery_date, delivery_time_slot,
      special_instructions, agent_location, delivery_proof,
      customer_rating, distance_traveled, delivery_duration, delivery_payout
    ) VALUES (
      NEW.id, 
      NEW.agent_id,
      COALESCE((NEW.address->>'fullName'), (NEW.address->>'name'), 'Unknown'),
      COALESCE((NEW.address->>'phone'), ''),
      NEW.address,
      NEW.items, 
      NEW.total, 
      NEW.payment_status, 
      derived_payment_method,
      CURRENT_DATE, 
      NEW.delivery_time_slot, 
      NEW.special_instructions,
      NULL, -- No agent location available
      '{}'::jsonb,
      NULL, 
      NULL, 
      NULL, 
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER after_order_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
  EXECUTE FUNCTION create_delivery_history_entry();

-- Step 2: Fix qr_complete_delivery_atomic function
DROP FUNCTION IF EXISTS qr_complete_delivery_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION qr_complete_delivery_atomic(
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid order_id or agent_id'
    );
  END IF;
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check if already delivered
  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already delivered',
      'already_completed', true
    );
  END IF;
  
  -- Determine payment status
  v_payment_status := CASE WHEN p_payment_method = 'COD' THEN 'paid_cod' ELSE 'paid_online' END;
  
  -- BEGIN ATOMIC TRANSACTION BLOCK
  
  -- 1. Update order to delivered (this will trigger create_delivery_history_entry)
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id
    AND agent_id = p_agent_id;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or agent not authorized'
    );
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
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Delivery completed successfully',
    'order_id', p_order_id,
    'payout_amount', v_payout_amount,
    'payment_method', p_payment_method,
    'earning_id', v_earning_id
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Catch any errors and return them
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error during delivery completion',
    'details', SQLERRM
  );
END;
$$;