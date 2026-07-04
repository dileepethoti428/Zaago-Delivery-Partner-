## Root cause

There's a **key mismatch** between where the agent's location is written and where the 10km filter reads it from.

`supabase/functions/update-agent-location/index.ts` (line 269) writes into `driver_locations` using the **internal PK** as the key:
```
agent_id: agent.id  // = delivery_agents.id (internal UUID)
```
It also updates `delivery_agents.latitude / longitude / last_location_updated_at` for the same row.

But `supabase/functions/get-available-orders/index.ts` (lines 197–204) queries `driver_locations` by the **auth UUID** that the client passes in:
```
.eq('agent_id', agent_id)   // ← this is the auth uid, not delivery_agents.id
```

The two `agent_id` values are different UUIDs for the same partner (per project memory: "delivery_agents.id (Internal PK) vs agent_id (Auth UUID)"). So the query returns no row → `recorded_at=none` → `hasFreshAgentLocation=false` → the function returns `orders: []`.

That's why you see zero orders in *both* Nearby and Other, and the warning
`No fresh agent location for 17578977-... (recorded_at=none). Returning 0 available orders until location syncs.`

The saved locations for seller and customer are fine — they're never read for the visibility gate. Only the *agent's* location lookup is broken.

## Fix

Edit **only** `supabase/functions/get-available-orders/index.ts`. No DB migration, no frontend change, no change to the payout formula.

1. **Read the agent's location from the correct source.**
   In the existing `delivery_agents` lookup (currently `select('id')`), also select `latitude, longitude, last_location_updated_at`. `delivery_agents` is the source of truth for the partner's current location and is written on every sync.

2. **Fallback to `driver_locations` using the internal PK.** If `delivery_agents` has no lat/lng yet (edge case: first sync failed halfway), query `driver_locations` with `.eq('agent_id', deliveryAgentId)` (the internal PK), not the auth UUID. This is the key that `update-agent-location` actually writes.

3. **Freshness check unchanged** — still ≤10 min via `last_location_updated_at` (or `recorded_at` from the fallback). If stale/missing, keep returning `orders: []` with a clearer log line that shows both sources tried.

4. **Everything else stays as it is** — per-leg 10 km gate (`agent→shop ≤ 10` AND `agent→customer ≤ 10`), road-distance calculation, payout formula (`₹10 + ₹8×shop→customer`), assigned/subscription flows.

## Verification

- Deploy `get-available-orders` and call it as the affected agent (`17578977-5353-46fd-8ba0-9d2c058adcec`). Log should read `Resolved agent location from delivery_agents (age=Xs)` and `After 10km filtering (per-leg, road distance): N orders remain`.
- Spot-check DB: `select latitude, longitude, last_location_updated_at from delivery_agents where agent_id = '17578977-…'` — should show a recent timestamp.
- Every returned order must have `agent_to_shop_distance ≤ 10` and `agent_to_customer_distance ≤ 10`. Orders outside 10 km on either leg should NOT appear in either "Nearby" or "Other" on Home.
- Force-stale by setting `last_location_updated_at` to 30 min ago → function should return `orders: []` (not the full pool).

## Not changed

- Client-side location sync (`useLocationSyncController`, `update-agent-location`) — writes are correct, the bug is only on the read side.
- Seller / customer coordinates and their tables.
- `useOrders`, `OrderCard`, Home layout, sorting, or the "Other Orders" section — with the filter fixed, that section will naturally be empty when nothing is out-of-range.
