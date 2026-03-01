

# Fix: Slow Orders Page + WhatsApp Button Error

## Issue 1: Orders Page Loading Slowly

**Root Cause**: The loading is slow due to a waterfall of sequential network calls:

1. `useProfile(user?.email)` -- fetches profile via direct DB query (fast)
2. Only AFTER profile loads, `useOrders(profile?.agent_id)` fires -- calls `get-available-orders` edge function
3. The edge function itself does 6+ sequential DB queries (agent lookup, location, completed orders, orders, rejections, user roles per order, delivery slots per order)
4. When agent location IS available, it also makes **2 Google Distance Matrix API calls PER order** (agent-to-shop + shop-to-customer) -- this is the biggest bottleneck
5. The Home page also waits for geolocation (`!lastKnown`) before showing any orders, even if orders are already fetched

**Fix**:
- Show orders immediately when data arrives, don't block on `lastKnown` location
- In the edge function, batch the Google Distance Matrix calls using the multi-destination feature (1 API call for all orders instead of 2N calls)
- Run independent DB queries in parallel using `Promise.all` instead of sequentially
- Add a loading placeholder that shows partial data while distance calculation runs

### Changes:

**`src/pages/Home.tsx`**:
- Change loading condition from `!lastKnown || loading` to just `loading` -- show orders even before geolocation resolves
- Move the "Getting your location..." message to a non-blocking banner instead of replacing the entire order list

**`supabase/functions/get-available-orders/index.ts`**:
- Run `delivery_history`, `agent location`, `delivery_timings`, and `agent_order_rejections` queries in parallel using `Promise.all` (currently sequential = ~4 round trips)
- Batch Google Distance Matrix API calls: instead of calling `calculateRoadDistance()` 2x per order in a loop, collect all origin-destination pairs and make 1-2 batch API calls (Google supports up to 25 origins x 25 destinations per request)
- Run `user_roles` checks in parallel with `Promise.all` instead of awaiting each one sequentially inside `.map()`

---

## Issue 2: WhatsApp Button Shows Error

**Root Cause**: `window.open('https://wa.me/917842343642', '_blank')` does not work reliably in Capacitor/WebView environments. The `_blank` target tries to open a new browser tab, which WebViews typically block or handle incorrectly, causing an error.

**Fix**: Use `window.location.href` assignment instead, which works in both browser and Capacitor WebView. For external links in Capacitor, this triggers the system browser/app intent correctly.

### Change:

**`src/pages/Profile.tsx`** (line 172):
```
// Before
window.open('https://wa.me/917842343642', '_blank');

// After  
window.location.href = 'https://wa.me/917842343642';
```

However, this navigates away from the app. A better approach is to use `window.open` without `_blank`, or wrap in a try-catch with fallback:

```typescript
const handleWhatsAppClick = () => {
  const url = 'https://wa.me/917842343642';
  try {
    // Try opening in system browser (works in Capacitor)
    window.open(url, '_system');
  } catch {
    // Fallback: direct navigation
    window.location.href = url;
  }
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | Fix WhatsApp link to use `_system` target with fallback |
| `src/pages/Home.tsx` | Don't block order display on geolocation; show orders immediately |
| `supabase/functions/get-available-orders/index.ts` | Parallelize DB queries with `Promise.all`; batch Google Distance Matrix calls |

## Expected Results

- **Orders page**: Loads significantly faster. DB queries run in parallel (saving ~1-2s). Google API calls batched (saving ~2-5s when orders exist). Orders show immediately without waiting for GPS.
- **WhatsApp**: Opens WhatsApp correctly on both browser and native Capacitor without errors.

