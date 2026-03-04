
## Plan: All-Time Earnings + Date Range Filter

### What needs to be added

**1. New edge function: `get-earnings-by-daterange`**  
A new lightweight edge function that accepts `from_date` and `to_date` (ISO strings) and returns aggregated earnings + records from `agent_earnings_tracking` for that date range. This avoids modifying the existing `get-agent-live-earnings` function.

**2. Update `get-agent-live-earnings`** to also return `all_time` earnings  
Add a query with no date filter to compute the all-time total. The current function only queries from `monthStart` — need to fetch all records for all-time total.

**3. New hook: `useEarningsByDateRange`**  
Accepts `{ fromDate, toDate }` and calls the new edge function using `useQuery`.

**4. Update `src/services/earnings.ts`**  
Add `fetchEarningsByDateRange(from: string, to: string)` function and `AllTimeEarnings` interface.

**5. Update `src/pages/Earnings.tsx`**  
- Add an "All Time" summary card using data from `earningsData?.all_time`
- Add a **Date Filter** section below the summary cards: two date pickers (From / To) + "Search" button
- Show filtered results in a `RecentEarningsList` below with total amount for that period
- Loading state while fetching filtered results

### Visual layout (All tab)
```
Today's Earnings [featured card]

This Week | This Month
          
All Time [new amber card]

──────────────────────────────
Date Filter
[From: date picker] [To: date picker]
        [Search Earnings]
──────────────────────────────
[Filtered results list OR recent earnings]
```

### Files changed
- `supabase/functions/get-earnings-by-daterange/index.ts` — new edge function
- `supabase/functions/get-agent-live-earnings/index.ts` — add `all_time` field (fetch without date filter)
- `src/services/earnings.ts` — add `fetchEarningsByDateRange`
- `src/hooks/useEarningsByDateRange.ts` — new hook
- `src/pages/Earnings.tsx` — add All Time card + date filter UI

### Edge function logic
```typescript
// get-earnings-by-daterange
// Body: { from_date: "2025-01-01", to_date: "2025-03-04" }
// Queries agent_earnings_tracking where accepted_at BETWEEN from_date AND to_date+end_of_day
// Returns: { total, pending, confirmed, deliveries, cancelled, records[] }
```

### All-time in existing function
Change the fetch in `get-agent-live-earnings` to remove the `.gte('accepted_at', monthStart)` filter (fetch ALL records), then compute month/week/today by filtering in memory — same as it does now but on the full dataset. Add `all_time` calculation using the full dataset.

Wait — the current function fetches from `monthStart` which limits the dataset. If we remove that filter, it could be a large payload. Better approach: keep the month filter for normal data, and make a **separate count query** for all_time totals only (sum + count, not all records). Use `.select('expected_payout, actual_payout, payout_status')` for all_time — no limit needed since it's aggregated in JS, or use `count` RPC.

Actually simplest approach: add a second query in `get-agent-live-earnings` that fetches all records but only selects `expected_payout, actual_payout, payout_status` (3 columns) — lightweight for all-time total calculation. No raw SQL needed.
