

## Root Cause: Query Structure Mismatch

The `daily_orders.quantity` column has type `numeric` in the database, but the three RPCs declare it as `integer` in their `RETURNS TABLE` definition:

```
RETURNS TABLE(... quantity integer ...)  -- declared as integer
-- but actual column is: quantity numeric
```

PostgreSQL raises a "structure of query does not match function result type" error because the SELECT returns `numeric` but the function signature promises `integer`.

The `get_agent_orders_delivered_today` RPC already handles this correctly — it uses `quantity::numeric`.

### Fix

**Database migration** — Update all three RPCs to change `quantity integer` to `quantity numeric` in their RETURNS TABLE:

- `get_agent_orders_today`
- `get_agent_orders_tomorrow`
- `get_agent_orders_upcoming`

Change in each:
```sql
-- FROM:
quantity integer
-- TO:
quantity numeric
```

Also add explicit cast `d.quantity::numeric` in the SELECT for safety.

**No frontend changes needed** — the TypeScript types already have `quantity: number` which maps to both `integer` and `numeric`.

