

## Plan: Move "Regular" label inline beside status badge

### Change
In `src/components/order/OrderCard.tsx`, remove the full-width gray "REGULAR ORDER" banner for regular orders (lines 149-153) and instead add a small inline "Regular" badge next to the `StatusPill` in the customer name row (line 161).

### Details

**Remove** (lines 149-153):
```tsx
{!isBookNowGetLater && !isSubscription && !isScheduled && (
  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 -mx-1 border border-border">
    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Regular Order</span>
  </div>
)}
```

**Add** inline badge after `StatusPill` (around line 161):
```tsx
<StatusPill status={order.status} />
{!isBookNowGetLater && !isSubscription && !isScheduled && (
  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase">Regular</span>
)}
```

No changes to BNGL, Scheduled, or Subscription banners.

### File
- `src/components/order/OrderCard.tsx`

