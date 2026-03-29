

## Plan: Add Tip Support to Delivery Partner Earnings

### Current state
- No `tip_amount` column exists in `orders`, `delivery_history`, or `agent_earnings_tracking` tables
- The customer app may show a tip UI but nothing is saved to the database yet
- The delivery completion RPC (`complete_delivery_zepto`) does not handle tips

### What needs to happen

**Step 1 — Add `tip_amount` column to 3 tables (DB migration)**

| Table | Column | Type | Default |
|-------|--------|------|---------|
| `orders` | `tip_amount` | `numeric` | `0` |
| `delivery_history` | `tip_amount` | `numeric` | `0` |
| `agent_earnings_tracking` | `tip_amount` | `numeric` | `0` |

This lets the customer app save the tip on the order, and the delivery pipeline carry it through to earnings.

**Step 2 — Update `complete_delivery_zepto` RPC**
- Read `v_order.tip_amount` from the order
- Add it to the final payout: `v_payout := base + distance + tip`
- Store `tip_amount` in `delivery_history` and `agent_earnings_tracking`
- Include tip in wallet transaction

**Step 3 — Update `unified-complete-delivery` edge function**
- For regular orders: the RPC handles it (step 2)
- For subscription/daily orders: read tip from `daily_orders` if applicable and pass through to `delivery_history`

**Step 4 — Update `get-agent-live-earnings` edge function**
- Include `tip_amount` in the earnings record response
- Add tip to the formatted earning record so the UI can display it

**Step 5 — Update earnings UI**
- Add `tip_amount` to `EarningRecord` type in `src/services/earnings.ts`
- Show tip as a separate line in `RecentEarningsList` payout breakdown (e.g., "Tip: ₹20")
- Include tip in the `EarningsSummaryCard` totals (already included via payout, just needs display)

**Step 6 — Show tip on ManageDelivery page**
- After delivery completion, show tip amount in the success feedback if tip > 0

### Files to change
1. **DB migration** — add `tip_amount` to 3 tables
2. **DB migration** — update `complete_delivery_zepto` RPC
3. `supabase/functions/unified-complete-delivery/index.ts` — pass tip through for daily orders
4. `supabase/functions/get-agent-live-earnings/index.ts` — include tip in response
5. `src/services/earnings.ts` — add `tip_amount` to types
6. `src/components/earnings/RecentEarningsList.tsx` — show tip line item
7. `src/pages/ManageDelivery.tsx` — show tip in completion toast

### Expected result
- When a customer adds a tip on their order, it's saved to `orders.tip_amount`
- On delivery completion, the tip is added to the agent's payout
- Earnings page shows tip as a separate line: "Tip: ₹20"
- Total earnings include the tip amount
- Delivery partner can see exactly how much tip they received per delivery

### Important note
After this change, the **customer ordering app** needs to save `tip_amount` to the `orders` table when the customer selects a tip. That part is outside this delivery partner app — but the column will be ready for it.

