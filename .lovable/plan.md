

## Fix: Distance Pay label missing "/km" clarity

### Problem
On the Recent Regular Order Deliveries breakdown, the distance pay line reads:
```
Distance Pay (2.5 km × ₹8)
```
The `₹8` is the rate per km but it's not obvious — it looks like a bare number after the currency symbol. Adding `/km` makes it immediately clear.

### Fix
**File:** `src/components/earnings/RecentEarningsList.tsx` — line 172

Change:
```
Distance Pay ({earning.payout_breakdown.distance_km} km × ₹{earning.payout_breakdown.rate_per_km})
```
To:
```
Distance Pay ({earning.payout_breakdown.distance_km} km × ₹{earning.payout_breakdown.rate_per_km}/km)
```

### Result
Label will read: `Distance Pay (2.5 km × ₹8/km)` — clearly indicating the per-km rate.

