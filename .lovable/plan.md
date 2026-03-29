

## Fix: Recent Regular Deliveries showing "Pending" instead of "Delivered"

### Problem
The Recent Deliveries list shows "Pending" for delivered regular orders. This happens because the earnings UI maps `payout_status` (from `agent_earnings_tracking`) directly as the badge label. When `payout_status = 'pending'` (payout not yet settled), the badge says "Pending" — but the user expects to see "Delivered" since the delivery is complete.

### Root cause
In `get-agent-live-earnings` edge function (line 274):
```js
status: tracking.payout_status  // 'pending' means payout pending, NOT delivery pending
```

The `RecentEarningsList` component then shows an orange "Pending" badge for this value.

### Fix

**Option A (Recommended — frontend only):** Update `RecentEarningsList.tsx` to treat `pending` payout status as "Delivered" for display, since these records only exist in `agent_earnings_tracking` after a delivery is completed. Add a subtle "Payout pending" indicator instead.

Changes to `src/components/earnings/RecentEarningsList.tsx`:
- Rename the badge logic: `pending` → show green "Delivered" badge (delivery is done)
- Add a small secondary indicator like "₹ Payout pending" text for `pending` payout status
- Keep `confirmed` as green "Delivered" (already correct)
- Keep `cancelled` as red "Cancelled"

Updated `getStatusBadge`:
```typescript
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-green-600 text-white text-xs">Delivered</Badge>;
    case 'pending':
      return <Badge className="bg-green-600 text-white text-xs">Delivered</Badge>;
    case 'cancelled':
      return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};
```

For payout status visibility, change the "Expected" indicator (line 152-157) to show "Payout pending" so the agent still knows their money is processing:
```typescript
{earning.status === 'pending' && (
  <div className="text-xs text-muted-foreground flex items-center gap-1">
    <RefreshCw className="h-3 w-3" />
    Payout pending
  </div>
)}
```

### Scope
- Single file: `src/components/earnings/RecentEarningsList.tsx`
- No backend changes needed

### Result
- All completed deliveries show green "Delivered" badge
- Payout status still visible as a secondary "Payout pending" label
- No confusion between delivery status and payout status

