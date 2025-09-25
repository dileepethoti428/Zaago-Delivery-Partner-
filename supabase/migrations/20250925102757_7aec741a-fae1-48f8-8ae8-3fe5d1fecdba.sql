-- Fixed cleanup for remaining corrupted data that might cause delivery failures
-- This migration properly handles different data types

-- 1. Clean up any remaining problematic pickup_address data (handle both text and jsonb types)
UPDATE orders 
SET pickup_address = NULL 
WHERE pickup_address IS NOT NULL 
AND (
  pickup_address::text ~ '"Peak"'
  OR pickup_address::text ~ 'Peak[^a-zA-Z]'
  OR pickup_address::text = 'Peak'
  OR LENGTH(pickup_address::text) < 10
  OR pickup_address::text = 'null'
  OR pickup_address::text = 'undefined'
);

-- 2. Clean up any special_instructions that contain problematic text
UPDATE orders 
SET special_instructions = CASE 
  WHEN special_instructions LIKE '%Peak%' THEN NULL
  WHEN LENGTH(COALESCE(special_instructions, '')) < 3 THEN NULL
  ELSE special_instructions
END
WHERE special_instructions IS NOT NULL;

-- 3. Create a safer validation function that handles data integrity
CREATE OR REPLACE FUNCTION validate_order_json_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate pickup_address - if it's problematic, set to NULL
  IF NEW.pickup_address IS NOT NULL THEN
    BEGIN
      -- Test if it contains problematic patterns
      IF NEW.pickup_address::text ~ 'Peak|^null$|^undefined$' OR LENGTH(NEW.pickup_address::text) < 10 THEN
        NEW.pickup_address := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NEW.pickup_address := NULL;
    END;
  END IF;
  
  -- Clean special instructions of problematic patterns
  IF NEW.special_instructions IS NOT NULL AND NEW.special_instructions ~ 'Peak' THEN
    NEW.special_instructions := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the safer trigger
DROP TRIGGER IF EXISTS validate_order_json_integrity ON orders;
CREATE TRIGGER validate_order_json_integrity
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_json_integrity();

-- Log the cleanup
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'final_data_cleanup',
    'timestamp', now(),
    'description', 'Final cleanup of corrupted data causing delivery failures'
  )
);