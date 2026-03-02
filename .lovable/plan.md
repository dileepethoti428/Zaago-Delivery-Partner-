
## 3 Changes to `src/store/location.ts`

### Fix 1 — Remove duplicate GPS watcher (critical)
`startWatch` and `stopWatch` now do nothing with the native geolocation API — that's owned by `useLocationSyncController`. Replace both functions to only toggle the `isWatching` flag. Also remove the module-level `watchId`, `lastUpdateTime`, `labelTimeoutId` variables and the watcher cleanup in `reset()`.

### Fix 2 — Non-blocking reverse geocode in `refreshLabel`
Replace `const label = await reverseGeocode(point); set(...)` with a fire-and-forget `.then()` chain. The store action returns immediately; label updates when geocode resolves in background.

### Fix 3 — Adaptive GPS accuracy in `refreshLocation`
Change `enableHighAccuracy: true` → `enableHighAccuracy: document.visibilityState === 'visible'` in the `getCurrentPosition` call inside `refreshLocation`.

### Only file changed: `src/store/location.ts`
