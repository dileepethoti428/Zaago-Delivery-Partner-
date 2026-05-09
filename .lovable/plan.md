## Add "View More" to Recent Deliveries lists

Add an inline expansion button to both Recent Regular Order Deliveries and Recent Subscription Deliveries lists on the Earnings page. Initial render shows 5 items; each "View More" click reveals 5 more. A "View Less" button collapses back when fully expanded.

### Files to change

1. **`src/components/earnings/RecentEarningsList.tsx`**
   - Add `useState` for `visibleCount` (default 5).
   - Slice `earnings.slice(0, visibleCount)` instead of mapping all.
   - Below the list, add a "View More (N more)" button if `visibleCount < earnings.length`, and a "View Less" button if expanded beyond 5.
   - Remove the fixed `h-[400px]` ScrollArea wrapper (let list grow naturally with the button) — or keep ScrollArea and place the button inside; will keep ScrollArea but make height auto so it adapts.

2. **`src/components/earnings/SubscriptionDeliveryList.tsx`**
   - Same pattern: `visibleCount` state, slice, View More / View Less buttons.

### UX details
- Button uses `variant="ghost"` with `size="sm"`, full-width, centered text "View More" with chevron-down icon, "View Less" with chevron-up.
- Uses semantic tokens (`text-primary`).
- Button hidden when total ≤ 5.

No backend / hook / data-fetching changes — both lists already receive the full `recent_earnings` array from the earnings query.
