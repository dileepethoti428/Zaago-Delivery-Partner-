

## Root Cause: Google Maps API Called on EVERY Home Page Load — No Caching

### The Problem

The 5-day cache you already have is for the **address label** (Nominatim reverse geocode — "Hyderabad, Telangana"). That's working fine.

The API calls you're seeing are from the **Google Maps Distance Matrix API** inside the `get-available-orders` edge function. Every time the Home page opens:

1. `useOrders` hook calls `get-available-orders` (staleTime is only 30 seconds)
2. The edge function loops through every available order and makes **2 Google API calls per order**:
   - Agent → Shop distance
   - Shop → Customer distance
3. If there are 10 orders, that's **20 Google Maps API calls per Home page load**

This happens on every app open, every pull-to-refresh, every 30 seconds if the user stays on Home.

### Fix: Add Distance Caching in the Edge Function

Cache computed distances in a `distance_cache` table in Supabase. The key insight: shop→customer distance **never changes** (both are fixed locations), and agent→shop only changes when the agent moves significantly.

**Step 1 — Migration: Create `distance_cache` table**

```sql
CREATE TABLE distance_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  dest_lat numeric NOT NULL,
  dest_lng numeric NOT NULL,
  distance_km numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(origin_lat, origin_lng, dest_lat, dest_lng)
);

-- Index for fast lookups
CREATE INDEX idx_distance_cache_coords 
ON distance_cache(origin_lat, origin_lng, dest_lat, dest_lng);

-- No RLS needed — only edge functions access this table
ALTER TABLE distance_cache ENABLE ROW LEVEL SECURITY;
```

**Step 2 — Update `get-available-orders/index.ts`**

Modify `calculateRoadDistance` to:
1. Round coordinates to 3 decimal places (~111m precision) for cache key
2. Check `distance_cache` table first
3. Only call Google API on cache miss
4. Store result in cache on miss

```
Before: 20 Google API calls per load (10 orders × 2 legs)
After:  0 Google API calls (cache hit) or 2 per NEW order only
```

Shop→Customer distances are cached forever (locations don't change). Agent→Shop distances are cached with ~111m precision, so minor GPS jitter won't cause misses.

**Step 3 — Also increase `staleTime` in `useOrders` hook**

Currently 30 seconds — increase to 2 minutes so the app doesn't refetch orders as aggressively on app resume:

```ts
// src/hooks/useOrders.ts
staleTime: 2 * 60 * 1000,  // 2 minutes (was 30s)
```

### Files to change
1. **Migration** — create `distance_cache` table
2. **`supabase/functions/get-available-orders/index.ts`** — add cache lookup/store in `calculateRoadDistance`
3. **`src/hooks/useOrders.ts`** — increase `staleTime` from 30s to 2 minutes

### Impact
- First load with 10 orders: 20 API calls (same as now)
- Every subsequent load: **0 API calls** (all cached)
- New order appears: only 2 API calls for that order
- Saves ~95% of Google Maps API costs

