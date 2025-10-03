-- Fix create_delivery_history_entry to only use fields that exist in orders table
DROP FUNCTION IF EXISTS create_delivery_history_entry() CASCADE;

CREATE OR REPLACE FUNCTION create_delivery_history_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_method TEXT;
BEGIN
  -- Derive payment_method from payment_status
  v_payment_method := CASE 
    WHEN NEW.payment_status IN ('paid', 'pending') THEN 'Online'
    ELSE 'COD'
  END;

  -- Insert or update delivery history record (idempotent)
  -- Only use fields that exist in orders table, set others to NULL
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
    NULL,  -- delivery_notes: doesn't exist in orders table
    NULL,  -- delivery_payout: doesn't exist in orders table
    NULL,  -- distance_traveled: doesn't exist in orders table
    NULL,  -- agent_location: doesn't exist in orders table
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
    special_instructions = EXCLUDED.special_instructions,
    delivery_notes = EXCLUDED.delivery_notes,
    delivery_payout = EXCLUDED.delivery_payout,
    distance_traveled = EXCLUDED.distance_traveled,
    agent_location = EXCLUDED.agent_location,
    delivery_duration = EXCLUDED.delivery_duration,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_delivery_history_on_delivered ON orders;

CREATE TRIGGER create_delivery_history_on_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
  EXECUTE FUNCTION create_delivery_history_entry();