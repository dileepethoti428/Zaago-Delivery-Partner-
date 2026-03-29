

## Fix two issues: History "Pending" badge + "₹0" in earnings breakdown

### Issue 1: Delivery History showing "Pending"
In `DeliveryHistoryCard.tsx` line 78, the status pill uses `payment_status` (paid/pending) which refers to **COD settlement status**, not delivery status. Since the delivery is already in history, it's always "delivered."

**Fix in `src/components/delivery/DeliveryHistoryCard.tsx`:**
- Change the top-right `StatusPill` from `payment_status === 'paid' ? 'completed' : 'pending'` to always show `'completed'` (since all history items are delivered)
- Move payment status to the expanded Payment section only (it's already there on line 185-186)

### Issue 2: "₹0" above Total Payout in Regular Order breakdown
In `RecentEarningsList.tsx` lines 161-184, the Zepto-style breakdown shows `Base Pay: ₹0` and `Distance Pay: ₹0` when `payout_breakdown` has zero values (e.g. from older records or fallback data). The "0" the user sees is likely `₹0` for base_pay or distance_pay.

**Fix in `src/components/earnings/RecentEarningsList.tsx`:**
- When `payout_breakdown` values are all zero but we have a valid `validatedPayout > 0`, skip the breakdown and show only the total payout directly
- When breakdown values are genuinely zero and payout is also zero, hide the breakdown entirely

### Files to change
1. `src/components/delivery/DeliveryHistoryCard.tsx` — line 78: always show "completed" status
2. `src/components/earnings/RecentEarningsList.tsx` — lines 160-184: conditionally hide zero-value breakdown

### Result
- History cards show "Delivered" (green) instead of "Pending"
- Earnings breakdown hides meaningless ₹0 rows

