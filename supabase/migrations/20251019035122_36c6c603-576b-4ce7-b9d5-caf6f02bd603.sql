-- Fix race condition in delivery history trigger by adding advisory locks
CREATE OR REPLACE FUNCTION create_delivery_history_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment_method TEXT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Acquire advisory lock to prevent concurrent executions for the same order+agent
  SELECT pg_try_advisory_xact_lock(
    hashtext(NEW.id::text || COALESCE(NEW.agent_id::text, 'no-agent'))
  ) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    -- Another transaction is already processing this order, skip gracefully
    RAISE NOTICE 'Skipping delivery history creation - locked by another transaction for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- Derive payment_method from payment_status
  v_payment_method := CASE 
    WHEN NEW.payment_status IN ('paid', 'pending', 'paid_online') THEN 'Online'
    WHEN NEW.payment_status = 'paid_cod' THEN 'COD'
    ELSE 'COD'
  END;

  -- Insert or update delivery history record (idempotent with ON CONFLICT)
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    payment_method,
    payment_status,
    delivery_date,
    delivery_time_slot,
    special_instructions,
    delivery_notes,
    delivery_payout,
    distance_traveled,
    agent_location,
    delivery_duration,
    completed_at
  ) VALUES (
    NEW.id,
    NEW.agent_id,
    NEW.customer_name,
    NEW.customer_phone,
    NEW.address,
    NEW.items,
    NEW.total,
    v_payment_method,
    NEW.payment_status,
    CURRENT_DATE,
    NEW.delivery_time_slot,
    NEW.special_instructions,
    NULL,
    NULL,
    NULL,
    NULL,
    EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.created_at))::integer / 60,
    NEW.delivered_at
  )
  ON CONFLICT (order_id, agent_id) 
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    delivery_address = EXCLUDED.delivery_address,
    items = EXCLUDED.items,
    total_amount = EXCLUDED.total_amount,
    payment_method = EXCLUDED.payment_method,
    payment_status = EXCLUDED.payment_status,
    delivery_time_slot = EXCLUDED.delivery_time_slot,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW();
    
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If we still get a unique violation despite the lock, another transaction completed first
    RAISE NOTICE 'Delivery history already exists for order % - skipping insert', NEW.id;
    RETURN NEW;
END;
$function$;