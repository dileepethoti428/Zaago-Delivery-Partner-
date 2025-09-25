-- Clean up any corrupted pickup_address fields that contain the "Peak" token
UPDATE orders 
SET pickup_address = CASE 
  WHEN pickup_address::text LIKE '%Peak%' THEN NULL
  ELSE pickup_address
END 
WHERE pickup_address IS NOT NULL;