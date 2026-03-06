

## Root Cause: Vacation Not Showing for Customer

### Problem
There are **two** vacation tables in the database:
1. `subscription_vacations` — used by the seller app for longer/planned vacations
2. `subscription_vacation_periods` — used for shorter/ad-hoc vacation periods (this is where Dileep's vacation lives)

The RPCs (`get_agent_orders_today`, `get_agent_orders_tomorrow`, `get_agent_orders_upcoming`) only JOIN against `subscription_vacations`. They completely ignore `subscription_vacation_periods`.

**Proof from the database:**
- Dileep's subscription `c04f9e30` has an active vacation period today in `subscription_vacation_periods` (start: Mar 6, end: Mar 6, status: active)
- But the RPC only checks `subscription_vacations`, which has no entry for Dileep → vacation badge never shows

### Fix

**Database migration** — Update all three RPCs to also LEFT JOIN on `subscription_vacation_periods` and combine both checks:

```sql
LEFT JOIN subscription_vacations sv
  ON sv.subscription_id = d.subscription_id
  AND d.date BETWEEN sv.start_date AND sv.end_date
  AND sv.status IN ('approved', 'active')
LEFT JOIN subscription_vacation_periods svp
  ON svp.subscription_id = d.subscription_id
  AND d.date BETWEEN svp.start_date AND svp.end_date
  AND svp.status IN ('approved', 'active')
```

Then change the vacation flag from:
```sql
(sv.id IS NOT NULL)  -- current: only checks one table
```
to:
```sql
(sv.id IS NOT NULL OR svp.id IS NOT NULL)  -- checks both tables
```

**No frontend changes needed** — the `isOnVacation` field is already mapped and rendered correctly. It just needs the data to be `true`.

