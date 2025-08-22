-- Check what payment_status values are allowed in the orders table
SELECT 
    pgc.conname as constraint_name,
    pg_get_constraintdef(pgc.oid) as constraint_definition
FROM pg_constraint pgc
JOIN pg_class pgcl ON pgcl.oid = pgc.conrelid
JOIN pg_namespace pgn ON pgn.oid = pgcl.relnamespace
WHERE pgcl.relname = 'orders' 
AND pgc.contype = 'c'
AND pgc.conname LIKE '%payment_status%';