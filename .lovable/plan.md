## Root cause

In `supabase/functions/get-available-orders/index.ts`, the "10 km" rule is broken in two places:

### 1. No-location fallback returns ALL orders unfiltered (lines 748–804)
```
if (agentLocation && agentLocation.latitude && agentLocation.longitude) {
  // 10km filter runs
} else {
  // ❌ Every open order is returned with a default 2.5km payout
}
```
If the agent's location isn't fresh in `delivery_agents` (permission denied, background killed, first login, stale timestamp), the function skips the radius filter entirely and returns every open order in the system. This is the main reason partners see orders that are clearly far away.

### 2. The "≤10 km" check uses the wrong distance (line 693–696)
```
const totalDistance = (agentToShopDistance || 0) + (shopToCustomerDistance || 0);
if (totalDistance <= 10) { ...include... }
```
`totalDistance` is `agent→shop + shop→customer` (the whole trip). The intended rule per project memory is a **10 km visibility radius**, i.e. the pickup/customer must be within 10 km of the agent — not the sum of both legs. A shop 2 km from the agent with a customer 9 km from the shop (11 km total) is correctly nearby but gets excluded, while other edge combinations slip through inconsistently. The check needs to be on the per-leg distance from the agent, not the sum.

Also, when `pickupLocation` is missing (line 679–691), the function silently substitutes `agent→customer` as both legs, which then doubles the number and can wrongly exclude nearby orders.

## Fix

Edit **only** `supabase/functions/get-available-orders/index.ts`:

1. **Remove the unfiltered fallback.** If `agentLocation` is missing/stale (no lat/lng, or `location_updated_at` older than ~10 min), return an empty list with a log line — never dump every open order. Partners without a fresh location should see nothing until location syncs.

2. **Change the radius check to per-leg, not total.** Replace the `totalDistance <= 10` gate with:
   - `agentToShopDistance <= 10` **AND** `agentToCustomerDistance <= 10`
   
   Compute `agentToCustomerDistance` via `calculateRoadDistance(agent, customer)` alongside the existing two legs. Keep `shopToCustomerDistance` for payout only — it must not affect visibility.

3. **Keep the "skip if road distance cannot be calculated" behavior.** No Haversine fallback, no coordinate-less orders — that part is already correct.

4. **Keep payout logic unchanged** (`₹10 + ₹8×shopToCustomer`, per memory). Only visibility changes.

## Verification

- Log line after filter should read: `After 10km filtering: N orders remain (agent@lat,lng, all legs ≤10km)`.
- Call the edge function as an agent with a known location, confirm every returned order has `agent_to_shop_distance ≤ 10` and `agent_to_customer_distance ≤ 10`.
- Call it as an agent whose `location_updated_at` is stale — should return `orders: []` instead of the full open pool.
- Spot check in DB: pick one returned order, compute Mapbox distance from agent → customer, confirm ≤10 km.

## Not changed

- Frontend (`useOrders`, `OrderCard`, home page) — no UI logic change; it already just displays what the backend returns.
- Payout formula and `accept-order` distance mapping.
- Assigned/subscription order flows — the 10 km rule applies only to the "other/available orders" pool on Home, which is exactly this function.