-- Fix create_delivery_history_entry to completely remove latitude/longitude references
-- This resolves the "column latitude does not exist" error

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
    
    -- Insert into delivery_history WITHOUT any location columns
    INSERT INTO delivery_history (
      order_id, 
      agent_id, 
      customer_name, 
      customer_phone,
      delivery_address, 
      items, 
      total_amount, 
      payment_status,
      payment_method, 
      delivery_date, 
      delivery_time_slot,
      special_instructions, 
      delivery_proof,
      customer_rating, 
      distance_traveled, 
      delivery_duration, 
      delivery_payout
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
      '{}'::jsonb,  -- empty delivery_proof
      NULL,         -- customer_rating
      NULL,         -- distance_traveled
      NULL,         -- delivery_duration
      NULL          -- delivery_payout
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

-- Log the fix
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'fixed_delivery_history_trigger',
    'issue', 'Removed all latitude/longitude column references',
    'fixed_at', now()
  )
);