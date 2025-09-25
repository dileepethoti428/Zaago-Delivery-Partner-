-- Clean up any remaining corrupted data with proper casting
UPDATE orders 
SET pickup_address = NULL
WHERE pickup_address::text LIKE '%Peak%' 
   OR pickup_address::text LIKE '%"Peak"%';

-- Clean up corrupted special_instructions
UPDATE orders 
SET special_instructions = NULL
WHERE special_instructions LIKE '%Peak%';

-- Clean up any corrupted address fields
UPDATE orders 
SET address = '{"city": "Unknown", "full_address": "Address not available"}'::jsonb
WHERE address::text LIKE '%Peak%' OR address::text LIKE '%"Peak"%';

-- Clean up any malformed JSONB by testing if they can be cast properly
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id, pickup_address FROM orders WHERE pickup_address IS NOT NULL LOOP
        BEGIN
            -- Test if pickup_address is valid JSON
            PERFORM rec.pickup_address::jsonb;
        EXCEPTION 
            WHEN OTHERS THEN
                -- If not valid JSON, set to NULL
                UPDATE orders SET pickup_address = NULL WHERE id = rec.id;
        END;
    END LOOP;
END $$;