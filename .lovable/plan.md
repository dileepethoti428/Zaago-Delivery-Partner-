## Goal

Add a "Total Distance Covered" section on the Profile page, styled like the existing "Total Working Hours" card, with the same period filter (Today / Yesterday / Last 7 Days / Last 30 Days / All Time) and live km values from completed deliveries.

## Source of data

Per user choice, use **payout distance** — `agent_earnings_tracking.distance_km` (this is what the agent is paid for; matches Earnings page semantics). Filter rows for the agent and bucket by `created_at` in the same `Asia/Kolkata` windows used by `get_agent_work_hours_breakdown`. Only include rows with `payout_status IN ('confirmed','pending')` so cancelled orders don't inflate the total.

## Backend

Add one new SQL function (migration):

```text
get_agent_distance_breakdown(agent_uuid uuid) RETURNS jsonb
  -> { today, yesterday, week, month, all_time }  (numeric km, 2 decimals)
```

Implementation mirrors `get_agent_work_hours_breakdown`:
- Same five timezone-aware windows.
- `SUM(distance_km)` from `agent_earnings_tracking` where `agent_id = agent_uuid` and `payout_status` in `('confirmed','pending')`.
- `SECURITY DEFINER`, `STABLE`, `GRANT EXECUTE ... TO authenticated, anon`.

No new tables, no RLS changes, no edge functions.

## Frontend

1. New hook `src/hooks/useDistanceCovered.ts` — same shape as `useWorkHours`:
   - Resolves internal `delivery_agents.id` from `agent_id = userId`.
   - Calls `supabase.rpc('get_agent_distance_breakdown', { agent_uuid })`.
   - Returns `{ today, yesterday, week, month, allTime }` in km.
   - Same `staleTime` and `refetchInterval` behavior (refresh every 60s while online).
   - Export `formatKm(km)` → e.g. `"12.4 km"` / `"0 km"`.

2. `src/pages/Profile.tsx` — add a new card right below the Total Working Hours block, inside the same outer profile `Card`:
   - Icon: `MapPin` (already imported) in primary color.
   - Title: "Total Distance Covered".
   - Subtitle: "Based on completed deliveries".
   - Its own `Select` with the same 5 options, independent local state `distancePeriod`.
   - Right-aligned value using `formatKm(distanceBreakdown[distancePeriod])`.
   - Pulls data via `useDistanceCovered(user?.id, isOnline)`.

No changes to other pages, no changes to existing hooks, no Earnings/Edge function changes.

## Files

- New: `supabase/migrations/<timestamp>_add_get_agent_distance_breakdown.sql`
- New: `src/hooks/useDistanceCovered.ts`
- Edit: `src/pages/Profile.tsx` (add the Distance Covered block + hook usage + period state)
