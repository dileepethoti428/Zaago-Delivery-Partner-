
## Vacation Display on Orders Page

### How Vacations Work
The `subscription_vacations` table stores vacation periods (`start_date`, `end_date`, `status`) per `subscription_id`. When a customer is on vacation for a given day, their `daily_order` may still exist as `pending` — but the delivery should **not** happen. The agent needs to see this clearly so they don't attempt delivery.

### What Needs to Change

**1. Database RPCs** — `get_agent_orders_today`, `get_agent_orders_tomorrow`, `get_agent_orders_upcoming`

Add a LEFT JOIN to `subscription_vacations` and expose `is_on_vacation boolean` in the result:

```sql
LEFT JOIN subscription_vacations sv 
  ON sv.subscription_id = d.subscription_id 
  AND d.date BETWEEN sv.start_date AND sv.end_date
  AND sv.status IN ('approved', 'active')

-- in SELECT:
(sv.id IS NOT NULL) AS is_on_vacation
```

New migration file added to `supabase/migrations/`.

**2. `AssignedOrder` interface** — add `isOnVacation?: boolean` field

**3. `transformEnrichedOrders` in `assignedOrders.ts`** — map `is_on_vacation` from RPC row

**4. `AssignedOrderCard.tsx`** — show a yellow "On Vacation" badge and replace "Manage Delivery" button with a disabled "Skip — On Vacation" button when `order.isOnVacation` is true

### Visual Change on Card
```
┌────────────────────────────────────┐
│ Dileep  🔄 Subscription  🏖 On Vacation │
│ 📦 Vegetables × 1                  │
│ 📍 2G36+F7P, Gurram Konda...       │
│ ⏰ morning-early   📞 07842343642  │
│ ┌──────────────────────────────┐   │
│ │  🏖 Skip — Customer On Vacation  │  ← disabled, amber style
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

### Files Changed
- `supabase/migrations/[new].sql` — update 3 RPCs to add `is_on_vacation`
- `src/services/assignedOrders.ts` — add field to interface + transform
- `src/components/order/AssignedOrderCard.tsx` — vacation badge + disabled button
