

## Fix: Regular order earnings stuck as "pending" after delivery completion

### Root cause

Two writers insert into `agent_earnings_tracking` for the same order:

1. **`accept-order` edge function** (line 354): inserts with `payout_status: 'pending'` when agent accepts the order
2. **`complete_delivery_zepto` RPC** (line 133): inserts with `payout_status: 'confirmed'` when delivery completes

The RPC uses `ON CONFLICT DO NOTHING` (line 136), so when the accept-order row already exists, the confirmed insert is silently skipped. The record stays `pending` forever.

### Fix

Single database migration to change `ON CONFLICT DO NOTHING` to `ON CONFLICT ... DO UPDATE` in `complete_delivery_zepto`, so it updates the existing pending record to confirmed with the final payout data:

```sql
ON CONFLICT (order_id, agent_id) DO UPDATE SET
  payout_status = 'confirmed',
  completed_at = now(),
  actual_payout = EXCLUDED.actual_payout,
  expected_payout = EXCLUDED.expected_payout,
  distance_km = EXCLUDED.distance_km,
  payout_breakdown = EXCLUDED.payout_breakdown,
  payment_method = EXCLUDED.payment_method,
  tip_amount = EXCLUDED.tip_amount;
```

This also fixes the payout amount, since the accept-order estimates the payout while the RPC calculates the final exact amount.

### Also fix existing pending records

Add a second statement to update all currently-stuck pending records that have a matching `delivery_history` entry (meaning delivery was already completed):

```sql
UPDATE agent_earnings_tracking aet
SET payout_status = 'confirmed', completed_at = dh.completed_at
FROM delivery_history dh
WHERE aet.order_id = dh.order_id
  AND aet.agent_id = dh.agent_id
  AND aet.payout_status = 'pending'
  AND aet.order_type = 'regular';
```

### Scope
- Single database migration (recreate RPC + backfill fix)
- No frontend or edge function changes needed

### Result
- New deliveries: payout_status transitions from `pending` to `confirmed` automatically on completion
- Existing stuck records: retroactively fixed to `confirmed`
- Earnings page shows correct "Delivered" status with confirmed payout amounts

