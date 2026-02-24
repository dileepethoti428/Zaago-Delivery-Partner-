

# Reduce Location API Calls and Add Caching

## Problems Found

There are three sources of excessive API calls on the Home page:

1. **Duplicate GPS watchers**: `Home.tsx` calls `startWatch()` which creates a `watchPosition`, AND `useLocationSyncController` (mounted in AppProviders) creates a SECOND `watchPosition`. Both run simultaneously.

2. **Reverse geocode (Nominatim) has no caching**: Every time GPS updates (throttled to 30s), `refreshLabel()` is called after a 20s debounce, hitting the external Nominatim API. There is zero caching -- even if the agent hasn't moved at all, a new HTTP call is made.

3. **Backend sync fires regardless of movement**: `useLocationSyncController` sends location to `update-agent-location` every 15 seconds even if the agent's coordinates are identical to the last sync.

## Fix Plan

### 1. Remove duplicate watcher from Home.tsx

The `useLocationSyncController` (in AppProviders) already starts/stops GPS watching based on visibility and auth state. Home.tsx should NOT also call `startWatch()`/`stopWatch()` -- this creates a second watcher.

**File**: `src/pages/Home.tsx`
- Remove the `useEffect` at lines 112-118 that calls `startWatch()`/`stopWatch()`
- The location store is already populated by the sync controller in AppProviders

### 2. Cache reverse geocode label for 1 day

Add a distance-based check before calling the Nominatim API. If the agent hasn't moved more than 500 meters since the last geocode, skip the API call. Also store the geocoded label with a 24-hour TTL in localStorage.

**File**: `src/utils/geo.ts`
- Add a `GEOCODE_CACHE_KEY` constant for localStorage
- Store `{ lat, lng, label, timestamp }` after each successful geocode
- On `reverseGeocode()`, check if cached label exists AND distance from cached coords is less than 500m AND cache age is less than 24 hours -- if all true, return the cached label without an API call

### 3. Skip backend sync if agent hasn't moved

Add a distance check in `useLocationSyncController` before calling the edge function. If the new coordinates are within 20 meters of the last synced position, skip the API call.

**File**: `src/hooks/useLocationSyncController.ts`
- Store last synced lat/lng in a ref
- Before calling `update-agent-location`, check if distance from last sync is greater than 20 meters
- Only sync if the agent has actually moved

### 4. Increase location store throttle

The store's `UPDATE_THROTTLE_MS` is 30 seconds, which is reasonable. But the `LABEL_DEBOUNCE_MS` of 20 seconds means a geocode call happens frequently. Increase label debounce to 60 seconds since the label rarely changes.

**File**: `src/store/location.ts`
- Change `LABEL_DEBOUNCE_MS` from 20000 to 60000 (60 seconds)

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Remove `startWatch()`/`stopWatch()` useEffect (lines 112-118) |
| `src/utils/geo.ts` | Add localStorage cache with 24h TTL and 500m distance threshold to `reverseGeocode()` |
| `src/hooks/useLocationSyncController.ts` | Add 20m movement threshold before syncing to backend |
| `src/store/location.ts` | Increase `LABEL_DEBOUNCE_MS` from 20s to 60s |

### Expected Result

- **Before**: ~4 reverse geocode calls per minute, ~4 backend syncs per minute, 2 GPS watchers running
- **After**: 1 GPS watcher, reverse geocode only when agent moves 500m+ (cached for 24h), backend sync only when agent moves 20m+
- Significantly reduced API calls and battery usage

