## Change

Give the Home page "Refresh" button visible feedback while it's working.

## Fix

Edit **only** `src/pages/Home.tsx`:

1. Add local state `isRefreshing` (boolean).
2. In `handleRefresh`, set `isRefreshing` true before the awaits and reset it in `finally` (alongside the existing `refreshingRef` throttle guard).
3. On the Refresh `Button`:
   - Add `disabled={isRefreshing}` so it can't be double-tapped.
   - On the `<RefreshCw />` icon add `className={cn("h-4 w-4", isRefreshing && "animate-spin")}` — `animate-spin` is Tailwind's built-in continuous rotation, so it visibly spins while the refetch + location call are in flight.
4. Import `cn` from `@/lib/utils` if not already imported.

No other file changes. No new dependencies. Pull-to-refresh path already shows its own indicator and is unaffected.

## Verification

Tap Refresh on Home → the circular arrow icon spins for the duration of the refetch, then stops. Button is disabled during that time and re-enables on completion (both success and error).
