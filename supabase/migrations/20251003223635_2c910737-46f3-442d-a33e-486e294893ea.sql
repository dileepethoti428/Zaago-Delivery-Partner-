-- Step 1: Drop the existing payment_method constraint temporarily
ALTER TABLE delivery_history DROP CONSTRAINT IF EXISTS delivery_history_payment_method_check;

-- Step 2: Clean up NULL payment_method values - set them to 'COD' as default
UPDATE delivery_history 
SET payment_method = 'COD' 
WHERE payment_method IS NULL;

-- Step 3: Normalize any mixed-case payment methods to uppercase standard
UPDATE delivery_history 
SET payment_method = CASE 
  WHEN UPPER(payment_method) IN ('CASH', 'CASH ON DELIVERY') THEN 'COD'
  WHEN UPPER(payment_method) IN ('ONLINE', 'CARD', 'UPI', 'DIGITAL') THEN 'ONLINE'
  ELSE 'COD'  -- Default fallback
END
WHERE payment_method NOT IN ('COD', 'ONLINE');

-- Step 4: Re-apply the strict constraint (now all data is clean)
ALTER TABLE delivery_history 
ADD CONSTRAINT delivery_history_payment_method_check 
CHECK (payment_method IN ('COD', 'ONLINE'));

-- Step 5: Log the cleanup action
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'delivery_history_payment_method_cleanup',
    'timestamp', now(),
    'description', 'Cleaned up NULL and mixed-case payment_method values',
    'constraint_applied', 'payment_method IN (COD, ONLINE)'
  )
);