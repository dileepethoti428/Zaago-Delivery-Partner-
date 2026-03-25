
## Plan: Extend Location Cache to 5 Days

### What "location cache" means here

There are two separate caches in the location system:

1. **Reverse geocode cache** (`zaago_geocode_cache` in `src/utils/geo.ts`) — caches the human-readable address label (e.g. "Hyderabad, Telangana"). Currently TTL = **24 hours**.

2. **Last known location** (`zaago_last_loc` in `src/store/location.ts`) — caches raw GPS coordinates (lat/lng). This has **no TTL expiry** — it's always loaded on hydration. The GPS watcher continuously overwrites this anyway.

The user's request to "add location cache on home page to 5 days" means extending the **reverse geocode label cache** from 24 hours → **5 days**. This means the app won't call the Nominatim API repeatedly if the agent hasn't moved more than 500m within 5 days — the address label stays cached.

### Single change needed

**File: `src/utils/geo.ts`** — line 51

```typescript
// Before
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// After
const GEOCODE_CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
```

That's the only change. The distance threshold (500m) stays the same — if the agent moves more than 500m, the cache is invalidated and a fresh geocode is fetched regardless of TTL.

### Files to change
1. `src/utils/geo.ts` — change `GEOCODE_CACHE_TTL_MS` from 24h to 5 days (one line)
