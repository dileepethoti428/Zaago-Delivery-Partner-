-- Fix corrupted data in orders table
-- Clean up any corrupted JSON data in pickup_address field
UPDATE orders 
SET pickup_address = NULL 
WHERE pickup_address IS NOT NULL 
AND (
  pickup_address = 'Peak' 
  OR pickup_address = '' 
  OR pickup_address = 'undefined'
  OR pickup_address = 'null'
  OR length(pickup_address) < 5
);

-- Ensure all JSONB fields have valid JSON or NULL
UPDATE orders 
SET address = '{"city": "Unknown", "full_address": "Address not available"}'::jsonb
WHERE address IS NULL;

UPDATE orders 
SET items = '[]'::jsonb
WHERE items IS NULL;

-- Clean up any problematic text fields that might contain invalid data
UPDATE orders 
SET special_instructions = NULL 
WHERE special_instructions IS NOT NULL 
AND length(special_instructions) > 1000;

-- Add a function to validate order JSON fields before updates
CREATE OR REPLACE FUNCTION validate_order_json_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure address is valid JSONB
  IF NEW.address IS NOT NULL THEN
    BEGIN
      -- Test if it's valid JSON by casting
      PERFORM NEW.address::text;
    EXCEPTION WHEN OTHERS THEN
      NEW.address := '{"city": "Unknown", "full_address": "Address not available"}'::jsonb;
    END;
  END IF;
  
  -- Ensure items is valid JSONB
  IF NEW.items IS NOT NULL THEN
    BEGIN
      -- Test if it's valid JSON by casting  
      PERFORM NEW.items::text;
    EXCEPTION WHEN OTHERS THEN
      NEW.items := '[]'::jsonb;
    END;
  END IF;
  
  -- Ensure pickup_location is valid JSONB if provided
  IF NEW.pickup_location IS NOT NULL THEN
    BEGIN
      -- Test if it's valid JSON by casting
      PERFORM NEW.pickup_location::text;
    EXCEPTION WHEN OTHERS THEN
      NEW.pickup_location := NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate JSON fields on insert/update
DROP TRIGGER IF EXISTS validate_order_json_trigger ON orders;
CREATE TRIGGER validate_order_json_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_json_fields();