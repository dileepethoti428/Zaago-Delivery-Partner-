-- Clean up malformed JSON in pickup_address fields step by step
-- First, update entries with extra spaces to proper JSON format
UPDATE orders 
SET pickup_address = (
  REPLACE(
    REPLACE(
      REPLACE(pickup_address::text, '": "', '":"'),
      '", "', '","'
    ),
    '": ', '":"'
  )
)::jsonb
WHERE pickup_address IS NOT NULL 
AND pickup_address::text LIKE '%": "%';