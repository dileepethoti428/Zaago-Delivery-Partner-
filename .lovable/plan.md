
## Remove Date Range Filter, Keep All Time Earnings

Simple removal — strip out the date filter card and its dependencies from `Earnings.tsx`.

### What to remove from `src/pages/Earnings.tsx`:
1. Imports: `useEarningsByDateRange`, `Button`, `Popover`, `PopoverContent`, `PopoverTrigger`, `Calendar as CalendarPicker`, `cn`, `format`, `Search`, `CalendarIcon`, `X`
2. State: `fromDate`, `toDate`, `rangeData`, `rangeLoading`, `rangeError`, `fetchByDateRange`, `reset`
3. Functions: `handleSearch`, `handleClear`
4. The entire "Date Range Filter" `<Card>` block (~lines 155–245)
5. The conditional `{!rangeData && (` wrapper around `RecentEarningsList` — just always show the recent earnings list

### What stays:
- All Time amber card (already present, lines ~90–115)
- Today, Week, Month summary cards
- Delivery Statistics card
- Order Type Breakdown card
- Recent Deliveries list (always shown)

### Files changed:
- `src/pages/Earnings.tsx` — remove date filter section and cleanup unused imports/state
