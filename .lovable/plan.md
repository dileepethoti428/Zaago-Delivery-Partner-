
## Root Cause Analysis: Cancel Order After Accepting Returns 403 Error

### Issues Found (3 confirmed bugs)

**Bug 1 — CRITICAL: Wrong agent ID used in `cancel-delivery` for daily orders (the main 403 cause)**

In `daily_orders`, the `assigned_agent_id` column stores the **raw auth user UUID** (e.g., `17578977-5353-46fd-8ba0-9d2c058adcec`).

But `cancel-delivery` resolves the incoming `agent_id` to `delivery_agents.id` (the internal UUID, e.g., `c4b29233-d15c-497c-ad01-4c5238be2b4e`) and uses `resolvedAgentId` in both the ownership check and the `.eq('assigned_agent_id', resolvedAgentId)` filter.

`c4b29233 !== 17578977` → always 403 "Order is assigned to another agent".

**Fix**: For the daily order path, skip the ID resolution and use the raw `agent_id` directly for `assigned_agent_id` comparisons (since that column stores auth UUIDs).

---

**Bug 2 — SECONDARY: `accept-order` has incomplete CORS headers**

`accept-order/index.ts` line 6 only has 4 CORS headers:
```
'authorization, x-client-info, apikey, content-type'
```
The required standard is 8 headers including `x-supabase-client-platform`, `x-supabase-client-platform-version`, etc. This causes CORS preflight failures when the Supabase JS SDK v2.56.0+ sends its extra headers.

**Fix**: Update `accept-order` CORS headers to match the project standard.

---

**Bug 3 — MINOR: `cancel-delivery` not in `config.toml`**

Without an explicit entry, `cancel-delivery` defaults to `verify_jwt = true`. Since the function already validates JWT internally with the service role client, this isn't causing crashes but is an inconsistency that can cause subtle JWT validation issues.

**Fix**: Add `[functions.cancel-delivery] verify_jwt = true` to `config.toml`.

---

### Files to Change

1. **`supabase/functions/cancel-delivery/index.ts`**
   - In the daily order section: use `agent_id` (raw auth UUID) directly — not `resolvedAgentId` — when checking `daily_orders.assigned_agent_id`
   - Change the ownership check: `if (dailyOrder.assigned_agent_id && dailyOrder.assigned_agent_id !== agent_id)`
   - Change the update filter: `.eq('assigned_agent_id', agent_id)` (not resolvedAgentId)
   - Also update `agent_earnings_tracking` cancel to use `resolvedAgentId` still (earnings table uses delivery_agents.id)

2. **`supabase/functions/accept-order/index.ts`**
   - Update `corsHeaders` to include all 8 required Supabase SDK headers

3. **`supabase/config.toml`**
   - Add `[functions.cancel-delivery]` with `verify_jwt = true`

4. **`src/pages/ManageDelivery.tsx`**  
   - Also invalidate `assigned-orders` query after cancel (currently only removes `orders`) so My Deliveries refreshes correctly

---

### Summary

```text
User cancels a daily/subscription order
    ↓
ManageDelivery calls cancel-delivery with agent_id = auth UUID
    ↓
cancel-delivery resolves auth UUID → delivery_agents.id (internal UUID)
    ↓
Checks daily_orders.assigned_agent_id === resolvedAgentId
    ↓
daily_orders stores RAW auth UUID, not delivery_agents.id
    ↓
UUIDs don't match → 403 "assigned to another agent"
```
