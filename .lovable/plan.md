
## What's Actually Happening

The user's diagnosis points at Profile.tsx using `useProfile(user?.email)` (React Query) instead of the Zustand auth store. However, the auth store's `Profile` interface contains **different fields** from a different table:

- **Auth store profile** → `profiles` table → `full_name`, `approval_status`, `documents_submitted`
- **`useProfile` hook** → `delivery_agents` table → `name`, `profile_image`, `is_active`, `is_online`

These are genuinely different tables. Profile.tsx **must** use `delivery_agents` data (`name`, `profile_image`, `is_active`) — the auth store cannot supply these fields.

**The real problem** is that `useProfile` uses `user?.email` as the query key, and `user` can be transiently null/undefined after refresh before the session restores. This causes either:
1. The query to fire with `undefined` email → creates a disabled/pending query → `isLoading` stays true → stale data
2. Or email returned from `delivery_agents` query mismatches

## The Correct Fix (Minimal, Surgical)

### Option A — Switch `useProfile` to query by `user?.id` instead of email
The `delivery_agents` table has an `agent_id` field which is the auth user UUID. Querying by `agent_id = user.id` is far more stable than by email. The `fetchAgentProfile` service already has `data.agent_id` available.

### Plan: 2 targeted changes

**`src/services/agentProfile.ts`** — Add a new function `fetchAgentProfileById(userId)` that queries `delivery_agents` by `agent_id` (UUID) instead of `email`.

**`src/hooks/useProfile.ts`** — Add a new `useProfileById(userId)` hook that uses `user?.id` as the query key and calls the new fetch function. More stable than email because `user.id` is always the same UUID.

**`src/pages/Profile.tsx`** — Replace:
```ts
const { data: agentProfile, isLoading: loading } = useProfile(user?.email);
```
With:
```ts
const { data: agentProfile, isLoading: loading } = useProfileById(user?.id);
```

This keeps the same data source (`delivery_agents`) but eliminates the email instability. The query key becomes `['profile', userId]` where `userId` is the stable UUID from the session — never changes on refresh.

### Files to change
- `src/services/agentProfile.ts` — add `fetchAgentProfileById(userId: string)` 
- `src/hooks/useProfile.ts` — add `useProfileById(userId?: string)`
- `src/pages/Profile.tsx` — swap hook call to `useProfileById(user?.id)`
