

# Fix: Cancel Delivery Edge Function Error After Accepting Order

## Root Cause

There is an **ID mismatch** between the accept and cancel flows:

1. **accept-order** looks up the delivery agent by auth user ID (`agent_id` column), then stores `agentData.id` (the `delivery_agents` table's own UUID, e.g., `c4b29233-...`) into `orders.agent_id`
2. **ManageDelivery page** passes `profile.user_id` (the auth user ID, e.g., `17578977-...`) to `cancel-delivery`
3. **cancel-delivery** compares `order.agent_id` (`c4b29233-...`) with the passed `agent_id` (`17578977-...`) -- they never match
4. Result: the function hits line 203 (`order.agent_id !== agent_id`) and returns **403 "Order is assigned to another agent"**

This is why cancellation fails for every agent -- the two IDs are from different tables and will never be equal.

## Fix

Update `cancel-delivery/index.ts` to resolve the auth user ID to the delivery agent's table ID before comparing, just like `accept-order` does.

### Changes to `supabase/functions/cancel-delivery/index.ts`

After validating `order_id` and `agent_id` are present (line 35), and before any order queries, add a lookup step:

```typescript
// Resolve auth user ID to delivery_agents.id
const { data: agentData, error: agentError } = await supabase
  .from('delivery_agents')
  .select('id')
  .eq('agent_id', agent_id)
  .maybeSingle();

const resolvedAgentId = agentData?.id || agent_id;
```

Then use `resolvedAgentId` instead of `agent_id` in all comparisons and database operations throughout the function:
- Line 59: `dailyOrder.assigned_agent_id !== resolvedAgentId`
- Line 77: `.eq('assigned_agent_id', resolvedAgentId)`
- Line 100: `.eq('agent_id', resolvedAgentId)`
- Line 159-168: rejection insert with `resolvedAgentId`
- Line 203: `order.agent_id !== resolvedAgentId`
- Line 222: `.eq('agent_id', resolvedAgentId)`
- Line 257: `.eq('agent_id', resolvedAgentId)`
- Lines 269, 289: log/rejection inserts with `resolvedAgentId`

This ensures that whether the frontend passes an auth user ID or a delivery agent ID, the cancel function will correctly match against `orders.agent_id`.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/cancel-delivery/index.ts` | Add delivery_agents lookup to resolve auth user ID to agent table ID before all comparisons |

No frontend changes needed -- the fix is entirely in the edge function.

## After Fix

- Agent accepts order (stores `delivery_agents.id` as `orders.agent_id`)
- Agent cancels order (passes auth user ID, edge function resolves it to `delivery_agents.id`)
- IDs now match, cancellation succeeds

