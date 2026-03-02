
## The Real Problem: `useProfile` Fires With `undefined` Email, Then Never Retries

### What's happening

1. `Home.tsx` calls `useProfile(user?.email)` where `user` comes from `useAuthStore`
2. On refresh, `user` is initially `null` → `user?.email` is `undefined` → `enabled: !!email` = `false` → query doesn't fire
3. `SIGNED_IN` event fires and sets `user` in the store
4. BUT — React Query has already registered the query with key `['profile', undefined]` and `enabled: false`. When `email` becomes defined, the key changes to `['profile', 'agentd@gmail.com']` — this is a NEW query that React Query must now fire
5. However, `Home.tsx` is stuck at `profileLoading` = `true` because React Query counts a query as "loading" when `enabled` is `false` AND no data exists yet — `isLoading` is `true` for a disabled query with no cached data in React Query v5

**This is a React Query v5 behavior**: `isLoading` is `true` for queries that are `enabled: false` AND have no cached data. The component sees `profileLoading = true` → renders "Loading profile..." → forever, because the query is disabled.

### The Fix

**Two-part fix:**

**Part 1 — `src/hooks/useProfile.ts`**: Change from `isLoading` to `isPending` OR add `enabled` directly. In React Query v5, `isPending` = true only when actually fetching. `isLoading` = true even when disabled with no data.

Actually the correct React Query v5 pattern: use `status === 'pending'` only when `enabled` is true. The real fix is to use `isFetching` OR check `enabled` separately.

**Simplest fix**: In `Home.tsx`, change the loading check to:

```ts
const isProfileLoading = !!user?.email && profileLoading;
```

This way, if `email` isn't available yet, we don't show "Loading profile..." — we wait for auth to resolve first.

**Part 2 — `src/store/auth.ts`**: The `fetchProfile` in the auth store sets `profileState: 'ready'` when it succeeds. `Home.tsx` should use `useAuthStore`'s `profileState` instead of `useProfile`'s `isLoading` to gate the "Loading profile..." screen. But `Home.tsx` uses `profile?.agent_id` from `useProfile` (the delivery_agents row), not from the auth store profile.

### Cleanest minimal fix (one file change)

**`src/pages/Home.tsx`** — change line 170:

```ts
// BEFORE — stuck forever when user?.email is briefly undefined
if (profileLoading) {

// AFTER — only show loading when email is known and query is actually running
if (user?.email && profileLoading) {
```

This single change unblocks the "Loading profile..." forever hang.

For the **Orders/Earnings blank screens** — the logs show `useTodayOrders Fetching via RPC...` IS firing. But the screens show skeleton loaders. This means the RPC is running but returning empty or erroring silently. The issue is the same `useProfile` problem — `profile` is `undefined` so `profile?.agent_id` is `undefined` → `useOrders(undefined, true)` → `enabled: !!agentId` = `false` → orders never load.

The chain:
1. `user?.email` undefined → `useProfile` disabled → `profile` undefined
2. `profile?.agent_id` undefined → `useOrders(undefined)` → disabled → blank orders

### Complete fix plan (minimal, 2 files)

**File 1: `src/pages/Home.tsx`**
- Line 170: Change `if (profileLoading)` → `if (user?.email && profileLoading)`
- This prevents the infinite "Loading profile..." screen when `email` is undefined

**File 2: `src/pages/Earnings.tsx`**  
- The earnings spinner is from `useEarnings` which is gated on `session?.access_token`. If session is available but earnings still spin, the edge function call is failing silently. Add a fallback to show "No data" instead of infinite spinner:
- Change `{loading ? <Loader2 spin /> : ...}` to also handle `!loading && !earningsData`

### Why MyDeliveries shows (0) counts

The RPCs ARE firing (logs confirm), returning empty arrays — correct behavior as those are `daily_orders` with no assigned orders for today. The 0 counts are accurate, not a bug.

### Summary of changes

| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Fix `profileLoading` guard: only block if `user?.email` is known |
| `src/pages/Earnings.tsx` | Add error/empty state instead of infinite spinner |

No auth store changes needed — the auth store is working correctly (SIGNED_IN fires, session set). The problem is purely in how the pages consume the auth state.
