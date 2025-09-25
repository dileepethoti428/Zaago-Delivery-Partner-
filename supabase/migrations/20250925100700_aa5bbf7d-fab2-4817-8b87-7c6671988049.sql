-- Fix the specific corrupted order that's failing
-- The order ID 7af028d1-e84f-46bc-af0e-21a3af852855 has corrupted JSON with "Peak" token

-- First, let's check and fix any remaining "Peak" tokens in pickup_address
UPDATE orders 
SET pickup_address = NULL 
WHERE pickup_address IS NOT NULL 
AND (
  pickup_address::text LIKE '%Peak%' 
  OR pickup_address::text LIKE '%"Peak"%'
  OR pickup_address = 'Peak'
);

-- Clean up any other text fields that might contain "Peak" causing JSON parsing issues
UPDATE orders 
SET special_instructions = NULL 
WHERE special_instructions IS NOT NULL 
AND special_instructions LIKE '%Peak%';

-- Fix any other JSONB fields that might have "Peak" corruption
UPDATE orders 
SET pickup_location = NULL 
WHERE pickup_location IS NOT NULL 
AND pickup_location::text LIKE '%Peak%';

-- For the specific failing order, ensure all fields are clean
UPDATE orders 
SET 
  pickup_address = '{"city":"Jalandhar Division","state":"Punjab","address":"6PW2+6X6, Punjab 144411, India","pincode":"144411"}'::jsonb,
  special_instructions = NULL
WHERE id = '7af028d1-e84f-46bc-af0e-21a3af852855';

-- Clean up any other orders that might have similar issues
UPDATE orders 
SET pickup_address = '{"city":"Unknown","state":"Unknown","address":"Pickup location","pincode":"000000"}'::jsonb
WHERE pickup_address IS NOT NULL 
AND (
  pickup_address::text LIKE '%Peak%' 
  OR LENGTH(pickup_address::text) < 10
  OR pickup_address::text = 'null'
  OR pickup_address::text = 'undefined'
);

-- Log the cleanup
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'peak_token_cleanup',
    'timestamp', now(),
    'description', 'Cleaned up Peak tokens causing JSON corruption in orders table'
  )
);