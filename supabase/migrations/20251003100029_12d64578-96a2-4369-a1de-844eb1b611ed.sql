
-- ROOT CAUSE FIX: Update track_purchase_history function to use correct table name
-- This was causing BOTH QR and regular delivery completion to fail

DROP FUNCTION IF EXISTS track_purchase_history() CASCADE;

CREATE OR REPLACE FUNCTION track_purchase_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_value jsonb;
BEGIN
  -- Only track when order is delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- Loop through items and insert into the CORRECT table: user_purchase_history
    FOR item_value IN SELECT value FROM jsonb_array_elements(NEW.items) AS t(value)
    LOOP
      INSERT INTO user_purchase_history (
        user_id,
        product_id,
        order_id,
        quantity,
        unit_price,
        purchased_at
      ) VALUES (
        NEW.user_id,
        (item_value->>'id')::uuid,
        NEW.id,
        (item_value->>'quantity')::integer,
        (item_value->>'price')::numeric,
        NOW()
      )
      ON CONFLICT (user_id, product_id, order_id) 
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        purchased_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER track_purchase_history_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
  EXECUTE FUNCTION track_purchase_history();

-- Log the critical fix
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'critical_bug_fix',
    'issue', 'Fixed track_purchase_history to use user_purchase_history table',
    'impact', 'This was causing ALL delivery completions (QR and regular) to fail',
    'fixed_at', now()
  )
);
