## Goal
Add a time-of-day filter (Morning / Evening / All) to the My Deliveries page, defaulting to the current time of day.

## Buckets
Parse the order's `timeSlot` start time (e.g. `"10:00-12:00"` → 10).
- **Morning**: start hour 5–11 (5AM–12PM)
- **Evening**: start hour 16–20 (4PM–9PM)
- **All**: no time filter (default fallback)

Orders without a parseable `timeSlot` show only in **All**.

## Default
On mount, pick default from device local time:
- 5:00–15:59 → Morning
- 16:00–21:59 → Evening
- Otherwise → All

## UI (src/pages/MyDeliveries.tsx)
Add a second row of filter chips below the existing Today/Tomorrow/Delivered/All tabs:

```text
[ Morning (n) ] [ Evening (n) ] [ All (n) ]
```

Segmented control style using existing `Tabs`/`TabsList`/`TabsTrigger` for consistency. Counts reflect the currently selected date tab.

## Implementation
Only edit `src/pages/MyDeliveries.tsx`:
1. Add `type TimeFilter = 'morning' | 'evening' | 'all'` and `timeFilter` state initialized via a `getDefaultTimeBucket()` helper reading `new Date().getHours()`.
2. Add helper `getSlotStartHour(order)` that splits `order.timeSlot` on `-` / `:` and returns a number or null.
3. After the existing `filteredOrders` memo, add a `timeFilteredOrders` memo that applies the bucket filter.
4. Compute `timeCounts` (morning/evening/all) from `currentOrders` (post-search but simpler: from `currentOrders`, so counts stay stable while typing — apply search on top).
   - Final render list = `timeFilteredOrders` intersected with search results (compose both filters).
5. Render a new `Tabs` row bound to `timeFilter` with three triggers showing counts.
6. Reset `visibleCount` to 5 when `timeFilter` changes.
7. Empty state copy: when a bucket has 0 orders, show "No morning deliveries" / "No evening deliveries".

No backend, RPC, or service changes.
