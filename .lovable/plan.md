
## Root Cause: Deployed Edge Function is Stale

The `get-agent-live-earnings` edge function code has the `all_time` calculation in the file, BUT the previous deploy failed silently (due to edge function limit). The **currently running version** on Supabase does NOT include the `all_time` field — that's why the UI shows ₹0.

Evidence from logs: The log line `"📊 All-time earnings:"` (line 320) is ABSENT from the edge function logs, confirming the deployed version is an older one without `all_time`.

## The Fix: Compute All-Time on the Frontend Directly

Since we can't deploy a new edge function and the existing one has a stale deploy, compute all-time earnings **directly from the frontend** using a Supabase table query. This is reliable and doesn't need any backend changes.

The `agent_earnings_tracking` table is accessible from the frontend. We already have `fetchAgentEarnings` in `src/services/earnings.ts` that queries it. We just need to use it properly in the Earnings page.

### Plan

**1. Update `src/hooks/useEarnings.ts`**
Add a second query inside the hook (or a separate `useAllTimeEarnings` hook) that directly queries `agent_earnings_tracking` from the client side to compute the all-time total.

**2. Update `src/pages/Earnings.tsx`**
Replace `earningsData?.all_time` with the direct query result.

### How it works
```typescript
// Direct Supabase query — no edge function needed
const { data } = await supabase
  .from('agent_earnings_tracking')
  .select('expected_payout, actual_payout, payout_status')
  .eq('agent_id', agentId);

// Sum up confirmed + pending
const allTimeTotal = data.reduce((sum, r) => 
  sum + (r.payout_status === 'confirmed' 
    ? parseFloat(r.actual_payout || 0) 
    : parseFloat(r.expected_payout || 0)), 0);
```

### Files to change
- `src/hooks/useEarnings.ts` — read the agent ID from auth store, add a direct `supabase` query for all-time totals
- `src/pages/Earnings.tsx` — use the new all-time data from the direct query

### Why this is better
- No edge function deploy needed
- Works immediately
- The data is already in `agent_earnings_tracking` and accessible via RLS
- Same data the edge function would return, just computed client-side

### What data exists (from DB check)
The agent has records totaling: 10.8 + 10.8 + 10.8 + 10.8 + 46.8 + 10.8 + 10.8 + 10.8 + 42 + 36.4 + 10.8 + 14 + 44.4 = **270.0** confirmed (non-zero). The all-time card should show this amount once the fix is deployed.
