

## Root Cause: Distance Badge Not Showing

The distance badge is not displaying because the seller coordinates come back as `NULL` from the database.

**Why:** The RPC joins `sellers` on `sel.id = p.seller_id`, but `products.seller_id` actually stores the **auth user ID** (e.g., `034f84a0-...`), while `sellers.id` is a different auto-generated UUID (e.g., `09312b33-...`). The correct join column is `sellers.user_id`.

**Proof from your data:**
- Product's `seller_id` = `034f84a0-f27e-42fd-805b-504d93db489d` (this is the auth user ID)
- `sellers.id` for that seller = `09312b33-03aa-4a33-a1ed-b6bdcc05f949` (no match)
- `sellers.user_id` = `034f84a0-f27e-42fd-805b-504d93db489d` (correct match)

### Fix

**Database migration** — Update all three RPCs (`get_agent_orders_today`, `get_agent_orders_tomorrow`, `get_agent_orders_upcoming`) to change the JOIN from:

```sql
LEFT JOIN sellers sel ON p.seller_id = sel.id
```

to:

```sql
LEFT JOIN sellers sel ON p.seller_id = sel.user_id
```

**No frontend changes needed** — the UI code already handles displaying the badge when `distanceFromShop` is non-null; it just needs the data to actually come through.

