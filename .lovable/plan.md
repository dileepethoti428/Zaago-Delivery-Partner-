

## COD Collection Tracker for Delivery Partners

### What the user wants
When a delivery partner completes COD orders, they collect cash from customers. They need to see:
1. How much total COD cash they currently hold (need to submit to seller)
2. Per-seller breakdown of pending COD amounts
3. When the seller marks it as "settled" from their app, it should sync and update automatically

### Current state
- A `cod_settlements` table already exists with columns: `id`, `order_id`, `agent_id`, `seller_id`, `amount`, `status`, `settled_at`, `created_at`, `updated_at`
- The table is currently empty — no records are being inserted
- `delivery_history` tracks completed deliveries with `payment_method` (COD/ONLINE) and `total_amount`
- The seller app presumably can update `cod_settlements.status` to mark cash as received

### Implementation Plan

**1. Auto-insert COD settlement records on delivery completion**
- Update the `unified-complete-delivery` edge function to INSERT into `cod_settlements` whenever `payment_method = 'COD'` with `status = 'pending'`
- This covers both regular and subscription/daily order completions
- Fields: `order_id`, `agent_id` (delivery_agents.id), `seller_id` (from the order), `amount` (total_amount), `status: 'pending'`

**2. Create a new edge function `get-agent-cod-balance`**
- Queries `cod_settlements` WHERE `agent_id = <agent>` AND `status = 'pending'`
- Groups by `seller_id`, joins seller name
- Returns: total pending amount, per-seller breakdown with amounts

**3. New frontend component: COD Collection Card**
- A card on the **My Deliveries** page (or Home page) showing:
  - Total pending COD amount to submit (highlighted in red/orange)
  - Per-seller breakdown (seller name + amount)
  - When seller settles, the amount disappears (realtime via Supabase subscription on `cod_settlements`)

**4. Realtime sync**
- Subscribe to `cod_settlements` table changes so when seller updates `status` to `settled`, the card updates automatically without refresh

### Technical Details

- **Edge function change**: `unified-complete-delivery` — add INSERT into `cod_settlements` after successful delivery completion for COD orders
- **New edge function**: `get-agent-cod-balance` — returns pending COD amounts grouped by seller
- **New hook**: `useCodBalance` — React Query hook calling the edge function
- **New component**: `CodCollectionCard` — displays pending COD on My Deliveries page
- **Realtime**: Subscribe to `cod_settlements` for status changes to invalidate the query cache
- **No migration needed**: `cod_settlements` table already exists with the right schema

