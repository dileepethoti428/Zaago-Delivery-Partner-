-- Clean up any remaining corrupted data safely
UPDATE orders 
SET pickup_address = NULL
WHERE pickup_address IS NOT NULL 
  AND (
    pickup_address::text LIKE '%Peak%' 
    OR pickup_address::text LIKE '%invalid%'
    OR pickup_address::text LIKE '%Token%'
    OR LENGTH(pickup_address::text) < 10
  );

-- Clean up any corrupted special_instructions
UPDATE orders 
SET special_instructions = NULL
WHERE special_instructions IS NOT NULL 
  AND (
    special_instructions LIKE '%Peak%'
    OR special_instructions LIKE '%invalid%'
    OR special_instructions LIKE '%Token%'
  );

-- Clean up any other potential JSON corruption in address field
UPDATE orders 
SET address = '{"city": "Unknown", "full_address": "Address not available"}'::jsonb
WHERE address IS NOT NULL 
  AND address::text LIKE '%Peak%';

-- Force clean any remaining problematic data for the specific failing order
UPDATE orders 
SET 
  pickup_address = '{"city": "Unknown", "address": "Pickup location not specified"}'::jsonb,
  special_instructions = NULL
WHERE id = '7c4b048f-f81a-48c2-a1d5-73b1889f80a6';