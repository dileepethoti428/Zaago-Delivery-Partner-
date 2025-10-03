-- Force recreation of track_purchase_history function to recognize existing unique constraint
-- The constraint exists but the function was cached before it was created

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
    
    -- Loop through items and insert into user_purchase_history
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
DROP TRIGGER IF EXISTS track_purchase_history_trigger ON orders;

CREATE TRIGGER track_purchase_history_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
  EXECUTE FUNCTION track_purchase_history();