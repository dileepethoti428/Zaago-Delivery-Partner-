
## Root Cause Found

The edge function IS computing `all_time` and returning it at line 308. The DB data confirms real confirmed earnings exist (₹25, ₹37, etc. each). But the UI shows ₹0.

**The real bug**: The `allTimeData` query only selects 3 columns:
```ts
.select('expected_payout, actual_payout, payout_status')
```
This is fine for totals — but looking at the DB data, records with `payout_status: 'confirmed'` have `actual_payout` as numeric values like `25.0`, `37`, etc. The `parseFloat()` should work.

**However**, the edge function was **deployed before the `all_time` addition** — meaning the currently running version may be an older cached deployment. The `all_time` field was added in the last round, but deploy may have failed silently.

**Additionally** — the `LiveEarningsData` type in `src/services/earnings.ts` needs to have `all_time` as a required field. Let me check if it was actually added.

Looking at the current `src/services/earnings.ts` from the provided file — it shows the original interface WITHOUT `all_time`. The type update may not have been saved properly.

**Fix plan:**

### 1. Verify & fix `src/services/earnings.ts`
Ensure `LiveEarningsData` includes `all_time: PeriodEarnings` field.

### 2. Re-deploy `get-agent-live-earnings`
The all_time computation is already in the edge function code. Re-deploy to ensure the latest version is live.

### 3. Add `all_time` logging to edge function
Add a console.log for `allTimeEarnings` to confirm it's computing correctly after re-deploy.

### Files to change:
- `src/services/earnings.ts` — add `all_time: PeriodEarnings` to `LiveEarningsData` interface if missing
- `supabase/functions/get-agent-live-earnings/index.ts` — add log for allTimeEarnings and re-deploy
