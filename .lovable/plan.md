
## Root Cause Found — Two Bugs Working Against Each Other

### Investigation Results

**Bug 1: Frontend cache (PRIMARY cause of user frustration)**

In `src/hooks/useProfile.ts`:
```ts
staleTime: 5 * 60 * 1000,  // 5 MINUTES cache
refetchOnWindowFocus: false, // won't refresh when agent comes back to app
```

This means even when the DB correctly updates `average_rating`, the Profile page shows the **old cached value for up to 5 minutes**. The agent gives a rating, checks the profile immediately → still sees old number because React Query is serving the 5-minute-old cache. This is the main reason it "doesn't change".

**Bug 2: Duplicate triggers + Dinesh's wrong stored rating**

Two triggers both fire on every new rating:
- `update_agent_rating_after_insert` (our first migration)
- `update_agent_rating_on_change` (our second migration)

Both call the same function. DB confirmation shows this caused Dinesh's stored average to be **3.90** while the actual correct average from ratings is **3.50** (8 ratings). The duplicate triggers are fighting each other.

Also confirmed: the trigger function logic itself has a subtle mismatch — it updates `WHERE id = COALESCE(NEW.agent_id, OLD.agent_id)` but the DB correctly joins on `delivery_agents.id = delivery_agent_ratings.agent_id`. This is actually correct and working for Dileep (2.8 stored = 2.8 correct ✓). Dinesh's mismatch is from historical data.

### Full Fix Plan

**1. Fix frontend — `src/hooks/useProfile.ts`**
- Drop `staleTime` from 5 minutes to **30 seconds**
- Add `refetchOnMount: 'always'` so profile is always fresh when the agent navigates to the Profile tab

**2. Fix database — migration**
- Drop the duplicate `update_agent_rating_on_change` trigger (keep `update_agent_rating_after_insert`)
- Re-sync Dinesh's correct average from 3.90 → 3.50

**Files to change:**
1. `src/hooks/useProfile.ts` — fix stale cache settings
2. Migration — drop duplicate trigger + fix Dinesh's stored rating

### Why This Will Now Work

```
Before fix:
  Customer rates → DB updates avg_rating → Agent checks profile → 
  Cache still serving 5-min-old data → Agent sees old rating ❌

After fix:
  Customer rates → DB updates avg_rating → Agent checks profile → 
  Profile refetches fresh data (max 30s stale) → Agent sees new rating ✓
```
