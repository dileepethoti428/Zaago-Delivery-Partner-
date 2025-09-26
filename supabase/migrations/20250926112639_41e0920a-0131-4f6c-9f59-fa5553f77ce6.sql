-- Step 1: Fix existing NULL/invalid amounts in agent_wallet_transactions
UPDATE agent_wallet_transactions 
SET amount = 25.00 
WHERE amount IS NULL OR amount <= 0;

-- Step 2: Set default value for future inserts
ALTER TABLE agent_wallet_transactions 
ALTER COLUMN amount SET DEFAULT 25.00;

-- Step 3: Create the safe payout calculation function
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
  
  -- Ensure minimum payout
  calculated_amount := GREATEST(calculated_amount, 20);
  
  -- Cap maximum payout for safety
  calculated_amount := LEAST(calculated_amount, 500);
  
  RETURN calculated_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;