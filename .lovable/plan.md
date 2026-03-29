

## Fix: Drop duplicate `complete_delivery_zepto` overload

### Problem
The last migration created a new version of `complete_delivery_zepto` without dropping the old one. Now PostgreSQL has two overloads with the same parameter names in different order, causing PostgREST's `PGRST203` ambiguity error.

### Fix
Single migration:
```sql
-- Drop the old signature (params in different order)
DROP FUNCTION IF EXISTS public.complete_delivery_zepto(uuid, text, uuid, numeric);
```

This leaves only the correct version. No other changes needed.

### Scope
- One database migration, one `DROP FUNCTION` statement
- No frontend or edge function changes

