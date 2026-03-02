
## Root Cause: TWO Separate Profile Systems, `useProfile` Never Resolves After Refresh

The app has a fundamental architecture mismatch:

**Auth store** (`src/store/auth.ts`) — fetches from `profiles` table using `user.id` → sets `profileState: 'ready'`

**`useProfile` hook** (`src/hooks/useProfile.ts`) — fetches from `delivery_agents` table using `email` → this is what `Home.tsx` uses for `profile?.agent_id`

These are TWO completely different profile fetches. The auth store being `ready` does NOT help `Home.tsx` at all.

### The Exact Failure Chain After Refresh

```
1. App boots → user = null, session = null
2. onAuthStateChange fires SIGNED_IN → user set, loading = false ✅
3. Home.tsx renders: useProfile(user?.email) fires with real email ✅
4. useProfile query fetches delivery_agents by email...
   BUT: isLoading = true while fetching
5. Home.tsx: if (user?.email && profileLoading) → returns "Loading profile..."
6. useProfile fetch completes → profileLoading = false → BUT...
7. profile = undefined because delivery_agents query returned null/missing
   OR fetch succeeded but Home still stuck
```

**The actual blocker found in the code:**

Line 185 in `Home.tsx`:
```ts
if (!profileLoading && !profile) {
  // Shows "Profile Not Found" error card, redirects to /upload-documents
}
```

If `useProfile` returns `null` data (agent not found by email, or email mismatch), the user sees an error and gets redirected. This could be happening after refresh if the email lookup is failing transiently.

**But the REAL problem is simpler:** The `useProfile` call at line 33:
```ts
const { data: profile, isLoading: profileLoading } = useProfile(user?.email);
```

`user` comes from `useAuthStore`. After a refresh with the current auth store, if `TOKEN_REFRESHED` fires first (which it now does), `user` IS set. But `email` might not match the `delivery_agents.email` field exactly.

### What to Actually Fix

The core architectural problem: `Home.tsx` uses `useProfile(user?.email)` which is a React Query hook hitting `delivery_agents` table. This is the ONLY query that needs to resolve for Home to render. 

**Three targeted fixes:**

#### Fix 1 — `Home.tsx`: Remove the `profileLoading` gate entirely
The loading skeleton while profile fetches is unnecessary UX friction. Instead, show the page with inline skeletons for the orders section (which already has its own loading state). The profile only provides `agent_id` for orders fetching — and if it's loading, orders simply won't fetch yet.

Change line 170:
```ts
// REMOVE THIS ENTIRE BLOCK (lines 169-182):
if (user?.email && profileLoading) {
  return <LoadingSkeleton />
}
```

The page already handles `loading` state for orders with inline skeletons. No need for a full-page loading gate.

#### Fix 2 — `Home.tsx`: Fix the "Profile Not Found" redirect
Line 185-197 shows an error if `!profile` after loading. But on refresh, `profileLoading` can momentarily be `false` with `profile = undefined` before React Query fires (the query key changed). This causes a flash to the error screen.

Change:
```ts
// BEFORE (can flash to error)
if (!profileLoading && !profile) { ... }

// AFTER (only error if we actually have user email and fetch completed)
if (user?.email && !profileLoading && profile === null) { ... }
```

Note: React Query returns `undefined` when query hasn't run yet, `null` only when it ran and found nothing. Using `=== null` prevents false error screens.

Actually, `useProfile` uses `maybeSingle()` which returns `null` when not found and the hook returns `data: null`. The issue is distinguishing "never fetched" (`undefined`) from "fetched and not found" (`null`).

#### Fix 3 — `useProfile`: Return `isFetching` and use it properly
The `isLoading` in React Query v5 is `true` when status is `'pending'` (query is in pending state with no data). Once a query has run once (even returning `null`), subsequent `isLoading` is `false` but `isFetching` is `true` while refetching.

The real issue: on a fresh page load after refresh, the query key changes from `['profile', undefined]` to `['profile', 'email@x.com']` which creates a brand NEW query with no cache → `isLoading = true` → this IS the correct behavior. So the gate `if (user?.email && profileLoading)` should work...

**Unless** `fetchAgentProfile` is throwing or returning `null` and causing the `!profile` error screen to flash.

### Confirmed Fix Plan (2 files, surgical)

**`src/pages/Home.tsx`** — 3 changes:
1. Remove the full-page profile loading gate (lines 169-182) — orders already have their own loading state
2. Only show "Profile Not Found" error if `user?.email` exists AND query is done AND data is explicitly `null` (not `undefined`)
3. Add a null-safe `profile?.agent_id` guard so orders query uses the auth store profile as fallback

**`src/hooks/useProfile.ts`** — 1 change:
- Add `retry: 2` and `retryDelay: 1000` so transient errors don't permanently block the profile

This is minimal and surgical. No auth store changes needed — auth store is working correctly based on the logs showing `SIGNED_IN` firing immediately.

### Why this will work

After fix:
1. `SIGNED_IN` fires → `user` set → `useProfile(email)` enabled and fetching
2. `Home.tsx` NO LONGER blocks on profile loading — renders immediately with orders loading skeleton
3. When `useProfile` resolves → `profile?.agent_id` becomes available → `useOrders` fires
4. Orders appear normally

The 13-second gap between `SIGNED_IN` (09:27:03) and `LocationSync Started` (09:27:16) in the logs is a strong signal that something is blocking React from rendering — the `profileLoading` gate causing the 13-second delay before the component tree beyond the loading state could mount.

### Files to change
- `src/pages/Home.tsx`: Remove profile loading gate, fix profile-not-found condition
- `src/hooks/useProfile.ts`: Add retry config
