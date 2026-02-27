

# Fix: Location Stuck on "Detecting Location" on Home Screen

## Root Cause

When the duplicate GPS watcher was removed from `Home.tsx`, the location store's `startWatch()` stopped being called. The `useLocationSyncController` runs its own `watchPosition` but only sends coordinates to the backend edge function -- it never updates `useLocationStore.lastKnown`. The Home page waits on `lastKnown` to be non-null before showing orders (line 260), so it stays stuck on "Getting your location..." forever (unless old data exists in localStorage).

```text
useLocationSyncController
  watchPosition -> syncToBackend (edge function only)
                   NEVER updates useLocationStore.lastKnown  <-- BUG

Home.tsx checks:
  if (!lastKnown) -> "Getting your location..."  <-- stuck forever
```

## Fix

Update `useLocationSyncController` to also update the location store whenever it receives a GPS position. This way there's a single GPS watcher that serves both purposes: backend sync AND UI state.

### File: `src/hooks/useLocationSyncController.ts`

1. Import `useLocationStore`
2. In the `watchPosition` success callback (line 68-71), update the location store with the new coordinates -- call the store's state setters directly (not `startWatch`, to avoid creating another watcher)
3. Also trigger `refreshLabel()` on the store (debounced) so the LocationChip shows the address

The key change in the watch callback:

```typescript
watchIdRef.current = navigator.geolocation.watchPosition(
  (position) => {
    if (isMountedRef.current) {
      // Update the location store so UI (Home, LocationChip) gets coordinates
      const store = useLocationStore.getState();
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      // Only update store if enough time has passed (reuse existing throttle)
      useLocationStore.setState({
        lastKnown: location,
        permission: 'granted',
        isWatching: true,
        error: null,
      });

      // Sync to backend (throttled, movement-gated)
      syncToBackend(position.coords);
    }
  },
  ...
);
```

Also persist to localStorage and trigger debounced label refresh, matching what the store's `startWatch` did.

### File: `src/store/location.ts`

Since `useLocationSyncController` now handles watching, the store's `startWatch()` should no longer be called separately. But `init()` should still hydrate from localStorage so the UI has data instantly on app open. No changes needed here -- just ensuring `init()` is called (it already is in AppProviders).

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useLocationSyncController.ts` | Update watch callback to write coordinates to `useLocationStore` state, persist to localStorage, and trigger debounced label refresh |

## Result

- On app open, `init()` hydrates `lastKnown` from localStorage (instant, no "detecting" delay)
- The single GPS watcher in `useLocationSyncController` updates both the store (for UI) and the backend
- No duplicate watchers, no stuck "detecting location" state
- LocationChip and Home page get coordinates immediately from the first GPS fix

