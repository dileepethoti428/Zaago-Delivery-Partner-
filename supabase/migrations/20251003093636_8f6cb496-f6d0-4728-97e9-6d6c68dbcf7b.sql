-- FIX: Make delivery history insertion idempotent to prevent duplicate key errors
-- This allows the trigger to safely run even if delivery history already exists

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
    
    -- Insert into delivery_history with ON CONFLICT to make it idempotent
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
    )
    ON CONFLICT (order_id) DO NOTHING; -- Skip if already exists
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