
## Plan: Fix AppLifecycle on Return from External Navigation Apps

### Root Causes

1. **`RESUME_DEBOUNCE_MS = 2000`** — 2 seconds is too short. Returning from Google Maps fires both `visibilitychange` AND `focus` events in quick succession, but if there's a slight gap > 2s between them, both trigger full resume logic.

2. **`refreshSession()` always force-calls `supabase.auth.refreshSession()`** — This makes a network call every single time you return from Maps, even if the token is fresh. This is what causes the 4s timeout error.

3. **`refreshQueries()` always invalidates 5 query keys** — Called on every resume, causing cascading refetches that race against each other.

4. **`useLocationSyncController` stops on `visibilitychange → hidden`** — Every time you open Maps, it stops. When you return, it restarts. This creates the start/stop churn.

5. **No concept of "short background"** — The lifecycle has no awareness of how long the app was backgrounded. 5 seconds away in Maps should be treated differently than 10 minutes away.

### Changes

#### `src/utils/appLifecycle.ts`
- Increase `RESUME_DEBOUNCE_MS` from **2000 → 30000** (30 seconds) — the key fix
- Add `lastBackgroundTime` tracking: record when app goes to background via `visibilitychange → hidden`
- In `onAppResume`: compute `backgroundDuration = now - lastBackgroundTime`
  - If `backgroundDuration < 5 minutes (300_000ms)` → **skip `refreshSession()` and `refreshQueries()`**, only do `resetAllLoaders()` + `unlockAllButtons()`
  - If `backgroundDuration >= 5 minutes` → run full resume (session check + query invalidation) — but still only refresh token if it's actually expired (check `session.expires_at`)
- Replace `refreshSession()` logic: instead of always calling `supabase.auth.refreshSession()`, first check `session.expires_at` — only force refresh if token expires within 60 seconds
- In `setupAppLifecycleListeners`: add `visibilitychange → hidden` listener to record `lastBackgroundTime`

#### `src/hooks/useLocationSyncController.ts`
- Remove the `stopSync()` call from `handleVisibilityChange` when going to background
- Instead: **keep the watch running** when going to background — geolocation `watchPosition` is already low-battery on background, and the sync throttle (15s) plus session guard prevents backend calls
- Only `stopSync()` on unmount (component teardown) or when session is lost
- This prevents the repeated start/stop cycles when switching to Maps and back

### Summary of Changes

| File | Change |
|------|--------|
| `src/utils/appLifecycle.ts` | 30s debounce, background duration tracking, smart session refresh (only if expiring), skip queries on short resume |
| `src/hooks/useLocationSyncController.ts` | Don't stop watch on background; only stop on logout/unmount |

### What stays unchanged
- Business logic, UI, auth store
- `resetAllLoaders()` and `unlockAllButtons()` still run on every resume (needed to unstick UI)
- Full query invalidation still happens after long background (≥5 min)
