
## Root Cause Found — Two Bugs Preventing Cancelled Orders from Showing to Other Agents

### Bug 1 — CRITICAL: `cancel-delivery` clears `agent_id` but NOT `assigned_agent_id`

**Database proof:**
```
Order b5a89853 after cancellation:
  status          = 'packed'    ✅ correct
  agent_id        = NULL        ✅ correct  
  assigned_agent_id = c4b29233  ❌ STILL SET — never cleared!
```

The `cancel-delivery` function (lines 230-239) only sets `agent_id = null`:
```typescript
.update({
  status: 'packed',
  agent_id: null,         // ✅ cleared
  // assigned_agent_id NOT cleared ❌
  updated_at: ...
})
```

But `get-available-orders` (line 307-309) filters available orders as:
```typescript
const isAvailable = order.agent_id === null && 
                    order.assigned_agent_id === null &&  // ← FAILS because still set!
                    order.status === 'packed';
```

So the order is `packed` with `agent_id = null` but `assigned_agent_id` is still the old internal ID — it **never appears as available** to other agents.

---

### Bug 2 — SECONDARY: Cancelling agent's own rejection record uses the wrong ID (though this would not matter for others, it prevents the cancelling agent from re-seeing it — not the main issue)

This is already working correctly per the DB query — `resolvedAgentId` is the internal ID and `agent_order_rejections` stores internal IDs. So that part is fine.

---

### Fix: One line change in `cancel-delivery`

In the regular order cancellation block, also clear `assigned_agent_id`:

```typescript
.update({
  status: 'packed',
  agent_id: null,
  assigned_agent_id: null,   // ← ADD THIS
  updated_at: new Date().toISOString()
})
```

---

### Files to change

**1. `supabase/functions/cancel-delivery/index.ts`** — line 230-239
- Add `assigned_agent_id: null` to the UPDATE for regular orders

**2. Fix existing stuck orders in DB** — a migration to clean up any orders that are currently stuck in this state (packed, agent_id null, assigned_agent_id set, not in delivery_history):
```sql
UPDATE orders 
SET assigned_agent_id = NULL, updated_at = NOW()
WHERE status = 'packed' 
  AND agent_id IS NULL 
  AND assigned_agent_id IS NOT NULL;
```

That's the entire fix — one field missing from the cancel UPDATE query.
