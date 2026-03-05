

## Route Optimization: Sort Subscription Orders by Distance from Shop

### Problem
Subscription orders on the My Deliveries page appear in arbitrary order. Delivery partners want them sorted nearest-first from the seller's shop location.

### Data Available
- `sellers` table has `latitude` and `longitude` columns
- The RPC `get_agent_orders_today` already joins `daily_orders → subscriptions → products`, and `products` has `seller_id`
- We just need one more JOIN to `sellers` to get shop coordinates

### Changes

**1. Database: Update RPCs to return seller coordinates**

Alter `get_agent_orders_today`, `get_agent_orders_tomorrow`, and `get_agent_orders_upcoming` to:
- JOIN `sellers` via `products.seller_id`
- Return `seller_latitude` and `seller_longitude` as additional columns

```sql
-- Add to existing SELECT:
sel.latitude AS seller_latitude,
sel.longitude AS seller_longitude
-- Add JOIN:
LEFT JOIN sellers sel ON p.seller_id = sel.id
```

**2. Frontend: `src/services/assignedOrders.ts`**

- Add `sellerLatitude` and `sellerLongitude` to `AssignedOrder` interface and `EnrichedOrderRow`
- Map them in `transformEnrichedOrders`

**3. Frontend: `src/pages/MyDeliveries.tsx`**

- After fetching orders, compute distance from seller shop to each customer using the existing `getDistanceKm` from `src/utils/geo.ts` (Haversine formula already implemented)
- Sort orders by distance (nearest first), with vacation orders pushed to the end
- Add `distanceFromShop` to each order for display

**4. Frontend: `src/components/order/AssignedOrderCard.tsx`**

- Accept optional `distanceKm` prop
- Display a small distance badge (e.g., "350m" or "1.2 km") on each card
- Add a "Navigate" button that opens Google Maps directions to the customer location

### What stays the same
- Haversine formula already exists in `src/utils/geo.ts` — reuse it
- No new tables or external APIs needed
- Delivered tab stays unsorted (historical)

