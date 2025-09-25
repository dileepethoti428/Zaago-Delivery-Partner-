-- Fix corrupted pickup_address JSON for order 7af028d1-e84f-46bc-af0e-21a3af852855
UPDATE orders 
SET pickup_address = '{"city":"Jalandhar Division","state":"Punjab","address":"6PW2+6X6, Punjab 144411, India","pincode":"144411"}'::jsonb
WHERE id = '7af028d1-e84f-46bc-af0e-21a3af852855' AND pickup_address::text LIKE '%Peak%';

-- Also clean up any other orders with similar corrupted data
UPDATE orders 
SET pickup_address = '{"city":"Unknown","state":"Unknown","address":"Address not available","pincode":"000000"}'::jsonb
WHERE pickup_address::text LIKE '%Peak%' AND pickup_address IS NOT NULL;