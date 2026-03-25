
## Two Changes Requested

### Change 1 — Delivery History: Show only 5 initially, with "View More" button

**Current**: `DeliveryHistory.tsx` loads all 50 and renders all of them.

**Fix in `src/pages/DeliveryHistory.tsx`**:
- Add `const [visibleCount, setVisibleCount] = useState(5)` local state
- Slice the history array: `history.slice(0, visibleCount)` when rendering
- Below the list, show a "View More" button only when `history.length > visibleCount`
- Clicking it sets `visibleCount` to show 5 more each time (or just reveal all at once)
- Badge at top stays showing total count

---

### Change 2 — Earnings: Add "All Time Deliveries" in Regular and Subscription tabs

The user wants an All Time total deliveries card — similar to the amber "All Time Earnings" card already on the "All" tab — added to the **Regular** tab and **Deliveries (Subscription)** tab.

**The `useAllTimeEarnings` hook** already fetches all records but doesn't split by order type. Need to extend it to also return `regularDeliveries` and `subscriptionDeliveries` counts.

**Fix in `src/hooks/useAllTimeEarnings.ts`**:
- Add `order_type` to the select query
- Return `regularDeliveries` (count of confirmed regular rows) and `subscriptionDeliveries` (count of confirmed subscription rows) in addition to existing fields

**Fix in `src/components/earnings/EarningsTabContent.tsx`**:
- Accept `allTimeDeliveries?: number` prop
- Add an amber "All Time Deliveries" card below the This Month/This Week grid (replacing the "This Month statistics" card position — i.e. the statistics card moves below it, or the all-time card replaces the statistics card as user said "in place of above one")

Wait — re-reading: "I want this should be in place of above one" — the user wants the All Time Deliveries card to **replace** the "Regular Order Statistics (This Month)" card shown in the screenshot for each respective tab.

**Fix in `src/components/earnings/EarningsTabContent.tsx`**:
- Replace the monthly delivery stats card with an "All Time Deliveries" card showing the all-time delivery count for regular orders

**Fix in `src/components/earnings/SubscriptionTabContent.tsx`**:
- Replace the "Subscription Delivery Statistics (This Month)" card with an "All Time Deliveries" card showing all-time subscription deliveries count

**Return type change in `src/hooks/useAllTimeEarnings.ts`**:
```ts
// Add to select:
.select('expected_payout, actual_payout, payout_status, order_type')

// Add to return:
regularDeliveries: number,      // confirmed rows where order_type = 'regular'
subscriptionDeliveries: number  // confirmed rows where order_type = 'subscription'
```

**Passing data down**:
- In `Earnings.tsx`, pass `allTimeDeliveries` from `allTimeData` to `EarningsTabContent` and `SubscriptionTabContent`

### Files to Change
1. `src/pages/DeliveryHistory.tsx` — add `visibleCount` state + "View More" button
2. `src/hooks/useAllTimeEarnings.ts` — add `order_type` to query, return `regularDeliveries` + `subscriptionDeliveries`
3. `src/components/earnings/EarningsTabContent.tsx` — replace monthly stats card with all-time deliveries card
4. `src/components/earnings/SubscriptionTabContent.tsx` — replace monthly stats card with all-time deliveries card
5. `src/pages/Earnings.tsx` — pass `allTimeData` props down to tab content components
