
## 3 targeted changes to `src/hooks/useLocationSyncController.ts`

### Fix 1 — Fire-and-forget backend sync (line 46)
Remove `await` from `supabase.functions.invoke(...)`. Chain `.catch()` instead of wrapping in try/catch. The GPS callback returns instantly, UI never waits for network.

### Fix 2 — Smart accuracy mode (lines 105-109)
Change `enableHighAccuracy: true` → `enableHighAccuracy: document.visibilityState === 'visible'`. Change `maximumAge: 5000` → `10000`, `timeout: 10000` → `15000`. When app is in background, GPS drops to low-power mode.

### Fix 3 — Throttle localStorage writes (lines 88-94)
Add `const lastPersistRef = useRef(0)` at the top of the hook. Wrap `localStorage.setItem` with a 30-second gate: only write if `Date.now() - lastPersistRef.current > 30000`. This eliminates synchronous blocking IO on every GPS tick.

### Only file changed: `src/hooks/useLocationSyncController.ts`
No other files need changes.
