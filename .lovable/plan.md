## Problem

The Recent Regular Order Deliveries card shows `₹8/km` even after you change the per-km rate in the `complete_delivery_zepto` SQL function. The DB already stores the correct `rate_per_km` inside `payout_breakdown`, but the UI overrides/falls back to a hardcoded `8`.

Two places in `src/components/earnings/RecentEarningsList.tsx` cause this:

1. **Hardcoded fallback in the label** (line ~163):
   ```ts
   Distance Pay ({...} × ₹{earning.payout_breakdown.rate_per_km ?? 8}/km)
   ```
   `?? 8` masks any DB value when missing or different.

2. **`getValidatedPayout` + `REGULAR_ORDER_PRICING` constant** (lines 10–40):
   Uses hardcoded `BASE_PAY: 10` and `DISTANCE_RATE: 8` to "auto-correct" the total. If your real DB rate is now (say) ₹10/km, this helper will incorrectly flag the row and recompute the total using ₹8.

So the DB change *is* working — the UI is just lying on top of it.

## Fix (frontend only, no DB or edge function changes)

Edit `src/components/earnings/RecentEarningsList.tsx`:

1. Remove the `REGULAR_ORDER_PRICING` constant and the entire `getValidatedPayout` helper. Trust the values returned by the backend (`payout_breakdown.base_pay`, `distance_pay`, `rate_per_km`, and `actual_payout` / `expected_payout`).
2. Render the rate directly from the breakdown without a hardcoded fallback:
   ```tsx
   Distance Pay ({earning.payout_breakdown.distance_km} km × ₹{earning.payout_breakdown.rate_per_km}/km)
   ```
   If `rate_per_km` is ever missing, derive it from `distance_pay / distance_km` instead of defaulting to `8`.
3. Replace `validatedPayout` usages with `earning.actual_payout ?? earning.expected_payout`.
4. Remove the `AlertTriangle` "auto-corrected" indicator (no longer needed) and its import if unused.

## Out of scope

- No changes to `complete_delivery_zepto`, edge functions, or `supabase/functions/_shared/regularOrderPricing.ts` (only used server-side).
- No changes to other earnings components.