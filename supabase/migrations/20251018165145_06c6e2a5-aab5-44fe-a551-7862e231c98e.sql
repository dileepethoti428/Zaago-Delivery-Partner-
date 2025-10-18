-- Step 1: Update CHECK constraint to temporarily accept both 'Online' and 'ONLINE'
ALTER TABLE delivery_history 
DROP CONSTRAINT IF EXISTS delivery_history_payment_method_check;

ALTER TABLE delivery_history 
ADD CONSTRAINT delivery_history_payment_method_check 
CHECK (payment_method = ANY (ARRAY['COD'::text, 'ONLINE'::text, 'Online'::text]));

-- Step 2: Create database function to normalize payment method at DB level
CREATE OR REPLACE FUNCTION normalize_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize payment_method to uppercase
  IF NEW.payment_method IS NOT NULL THEN
    NEW.payment_method := UPPER(NEW.payment_method);
    -- Ensure it's a valid value
    IF NEW.payment_method NOT IN ('COD', 'ONLINE') THEN
      NEW.payment_method := 'COD'; -- Default fallback
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to auto-normalize payment method before insert/update
DROP TRIGGER IF EXISTS normalize_payment_before_insert ON delivery_history;
CREATE TRIGGER normalize_payment_before_insert
BEFORE INSERT OR UPDATE ON delivery_history
FOR EACH ROW EXECUTE FUNCTION normalize_payment_method();