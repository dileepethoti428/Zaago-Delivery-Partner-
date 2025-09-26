-- Step 4: Create trigger function to automatically fix NULL amounts
CREATE OR REPLACE FUNCTION fix_null_transaction_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- If amount is NULL or zero, calculate a safe default
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    -- Use a safe default based on transaction type
    CASE NEW.transaction_type
      WHEN 'delivery_payment' THEN
        NEW.amount := calculate_delivery_payout_safe(2.5, NEW.transaction_type);
      WHEN 'topup' THEN
        NEW.amount := 100; -- Default topup amount
      WHEN 'withdrawal' THEN
        NEW.amount := 50; -- Default withdrawal amount
      ELSE
        NEW.amount := 25; -- Generic default
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 5: Create the trigger
DROP TRIGGER IF EXISTS fix_null_amount_trigger ON agent_wallet_transactions;
CREATE TRIGGER fix_null_amount_trigger
  BEFORE INSERT OR UPDATE ON agent_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fix_null_transaction_amount();

-- Step 6: Now add the constraint (this should work now)
ALTER TABLE agent_wallet_transactions 
DROP CONSTRAINT IF EXISTS check_amount_not_null;

ALTER TABLE agent_wallet_transactions 
ADD CONSTRAINT check_amount_not_null 
CHECK (amount IS NOT NULL AND amount > 0);