
## Root Cause: Wrong Agent ID passed to `useRejectOrder`

### The Bug

In `Home.tsx` line 155:
```typescript
await rejectOrderMutation.mutateAsync({ orderId, agentId: profile.agent_id });
```

`profile.agent_id` = auth user UUID (e.g., `17578977-...`)

But `agent_order_rejections.agent_id` is validated by RLS against `delivery_agents.id` (internal UUID, e.g., `c4b29233-...`):
```sql
-- RLS INSERT policy:
agent_id IN (SELECT delivery_agents.id WHERE email = auth.email())
```

`17578977 ≠ c4b29233` → RLS rejects the INSERT → "Failed to reject order" error.

**Second problem:** Even if the insert succeeded, `get-available-orders` queries `agent_order_rejections` using `resolvedAgentId` (internal ID `c4b29233`). If the row was stored with auth UUID `17578977`, the filter wouldn't match and the order would keep appearing for that agent — defeating the whole purpose of rejecting.

### Fix (one line)

In `src/pages/Home.tsx`, change `handleRejectOrder` to pass `profile?.id` (internal `delivery_agents.id`) instead of `profile?.agent_id`:

```typescript
// Before
await rejectOrderMutation.mutateAsync({ orderId, agentId: profile.agent_id });

// After  
await rejectOrderMutation.mutateAsync({ orderId, agentId: profile.id });
```

That's it — one field change. `profile.id` is the internal `delivery_agents.id` that matches the RLS policy and the `get-available-orders` rejection filter.

### Files to change

1. **`src/pages/Home.tsx`** — `handleRejectOrder` callback: `profile.agent_id` → `profile.id`

No backend changes needed. The edge function, RLS policy, and `get-available-orders` filter are all correct and already use `delivery_agents.id`.
