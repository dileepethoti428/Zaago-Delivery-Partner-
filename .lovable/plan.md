
## Plan: Search Bar on My Deliveries + Rating on Profile

### Feature 1: Search Bar on My Deliveries page (`src/pages/MyDeliveries.tsx`)

**Why**: With 40+ subscription orders, agents need to quickly find a customer by name, address, or product.

**What to add**: A search input below the tab bar that filters `currentOrders` client-side by:
- Customer name
- Delivery address
- Product name

The search is purely frontend — no extra API calls. State: `const [search, setSearch] = useState('')`. Filter applied after `currentOrders` is computed, before rendering the list. Show a clear (×) button when search has text. Show count of filtered results.

**Files to change**: `src/pages/MyDeliveries.tsx` only

---

### Feature 2: Rating display on Profile page (`src/pages/Profile.tsx`)

**Good news**: The `delivery_agents` table already has `average_rating`, `total_deliveries`, and `performance_score` columns — and `agentProfile` from `useProfileById` already fetches the full row. **No extra API call needed.**

**What to add**: A stats row inside the profile card showing:
- ⭐ Rating: `agentProfile.average_rating` (e.g. "4.8") — shown as star icons + number
- 📦 Total Deliveries: `agentProfile.total_deliveries`
- (optional) 🏆 Performance Score if non-null

Display as a horizontal 2–3 column grid below the name/badge row inside the existing profile card.

**Files to change**: `src/pages/Profile.tsx` only

---

### Summary of changes

```
src/pages/MyDeliveries.tsx
  - Add `search` state
  - Add search Input with Search icon + clear button (below tabs)
  - Add `filteredOrders` derived from `currentOrders` filtered by search text
  - Render `filteredOrders` instead of `currentOrders`
  - Show "No results for '...'" empty state when search returns nothing

src/pages/Profile.tsx
  - Add rating/stats row inside the profile card
  - Star rating display using agentProfile.average_rating (already fetched)
  - Total deliveries count from agentProfile.total_deliveries
```

No backend changes, no migrations, no new hooks needed.
