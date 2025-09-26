-- Step 1: Fix existing NULL/zero amounts first
UPDATE agent_wallet_transactions 
SET amount = 25.00 
WHERE amount IS NULL OR amount <= 0;

-- Step 2: Set default value for future inserts
ALTER TABLE agent_wallet_transactions 
ALTER COLUMN amount SET DEFAULT 25.00;

-- Step 3: Create safe calculation function
CREATE OR REPLACE FUNCTION calculate_delivery_payout_safe(
  p_distance_km NUMERIC DEFAULT 2.5,
  p_transaction_type TEXT DEFAULT 'delivery_payment'
) RETURNS NUMERIC AS $$
DECLARE
  calculated_amount NUMERIC;
BEGIN
  -- Base calculation: ₹20 base + ₹12/km beyond 1km
  IF p_distance_km <= 1 THEN
    calculated_amount := 20;
  ELSE
    calculated_amount := 20 + (p_distance_km - 1) * 12;
  END IF;
  
  -- Ensure minimum payout of ₹20, max ₹500
  calculated_amount := GREATEST(calculated_amount, 20);
  calculated_amount := LEAST(calculated_amount, 500);
  
  RETURN calculated_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger to prevent future NULL amounts
CREATE OR REPLACE FUNCTION fix_null_transaction_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- If amount is NULL or zero, calculate a safe default
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    CASE NEW.transaction_type
      WHEN 'delivery_payment' THEN
        NEW.amount := calculate_delivery_payout_safe(2.5, NEW.transaction_type);
      WHEN 'topup' THEN
        NEW.amount := 100;
      WHEN 'withdrawal' THEN
        NEW.amount := 50;
      ELSE
        NEW.amount := 25;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Apply the trigger
DROP TRIGGER IF EXISTS fix_null_amount_trigger ON agent_wallet_transactions;
CREATE TRIGGER fix_null_amount_trigger
  BEFORE INSERT OR UPDATE ON agent_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fix_null_transaction_amount();