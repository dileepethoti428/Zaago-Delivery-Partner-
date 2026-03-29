

## Fix: Replace `da.user_id` with `da.agent_id` in the RPC

### Root cause
Line 40 of `complete_delivery_zepto` references `da.user_id`, but the `delivery_agents` table uses the column `agent_id` to store the auth user UUID. This column has never been called `user_id`.

### Fix
One database migration to recreate `complete_delivery_zepto` with line 40 changed:

```sql
-- Before (broken):
WHERE da.user_id = v_auth_id AND da.is_active = true

-- After (fixed):
WHERE da.agent_id = v_auth_id AND da.is_active = true
```

Everything else in the RPC body stays exactly the same — pricing (₹10 base, ₹8/km), tip logic, rounding, FK handling are all correct.

### Scope
- Single database migration
- No edge function or frontend changes needed

### Expected result
The `column da.user_id does not exist` error disappears and delivery completion works end-to-end.

