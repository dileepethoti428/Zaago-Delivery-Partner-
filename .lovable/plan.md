

## Pickup Summary Card — Product Quantities by Seller

### What it does
A collapsible card at the top of the My Deliveries page (below COD card, above order list) that shows an aggregated pickup list grouped by seller. For each seller, it lists every product and total quantity to pick up — excluding vacation orders. This lets the delivery partner verify quantities at the seller's shop before starting deliveries.

### Example UI
```text
┌─────────────────────────────────┐
│ 📦 Pickup Summary (Today)      │
│                                 │
│ ▼ Fresh Farms (18 items)        │
│   • Full Cream Milk 500ml — 12  │
│   • Paneer 200g — 6             │
│                                 │
│ ▼ Green Basket (8 items)        │
│   • Organic Eggs (6pc) — 5      │
│   • Curd 400ml — 3              │
│                                 │
│ Excluding 3 vacation orders     │
└─────────────────────────────────┘
```

### Implementation

**No backend changes needed.** All required data (product name, quantity, vacation status, seller info) is already in the RPC response.

**1. New component: `src/components/delivery/PickupSummaryCard.tsx`**
- Accepts `orders: AssignedOrder[]` prop
- Filters out `isOnVacation === true` orders
- Groups remaining orders by seller (using seller coordinates as key, or product-level grouping)
- Within each seller group, aggregates by `productName` summing `quantity`
- Shows total item count per seller
- Uses `Collapsible` from Radix for each seller section
- Shows a note at bottom: "Excluding X vacation orders" if any exist
- Renders nothing if no orders

**2. Update `src/pages/MyDeliveries.tsx`**
- Import and render `<PickupSummaryCard orders={currentOrders} />` between the COD card and the tabs (or just below tabs)
- Only show for today/tomorrow/all tabs (not delivered)

**3. Data needed from existing `AssignedOrder`**
- `productName` — product to pick up
- `quantity` — how many units
- `isOnVacation` — to exclude
- `sellerLatitude`/`sellerLongitude` — to group by seller (or we can group by `productId` + seller coords)

Since we don't have `sellerName` in the current RPC response, we'll need to add it.

**4. Migration: Add `seller_name` to the 3 RPCs**
- Add `seller_name text` to the `RETURNS TABLE` of `get_agent_orders_today`, `get_agent_orders_tomorrow`, `get_agent_orders_upcoming`
- Add `sel.business_name AS seller_name` to the SELECT (from the already-joined `sellers` table)
- Update `EnrichedOrderRow` interface and `AssignedOrder` interface to include `sellerName`

