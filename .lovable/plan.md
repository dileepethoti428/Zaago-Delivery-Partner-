

## Fix: Hardcode fallback `8` for missing `rate_per_km`

### Problem
`payout_breakdown.rate_per_km` is not stored in older records, so the label renders `₹/km` with nothing before `/km`.

### Fix
**File:** `src/components/earnings/RecentEarningsList.tsx` — line 172

Change:
```tsx
₹{earning.payout_breakdown.rate_per_km}/km
```
To:
```tsx
₹{earning.payout_breakdown.rate_per_km ?? 8}/km
```

Since the rate is always ₹8/km, this fallback covers all records where the field wasn't persisted.

### Single line change, no backend changes.

