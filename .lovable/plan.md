
## Plan: Fix Home "Other Orders" cards so Regular and BNGL look different

### What I found
The screenshot matches the `/home` page’s **Other Orders** section.

That section is the real problem:
- **Nearby Orders** use `OrderCard`, which already supports:
  - Regular = default
  - Scheduled = blue
  - Subscription = purple
  - BNGL = amber
- But **Other Orders** in `src/pages/Home.tsx` do **not** use `OrderCard`
- They render a separate custom `AnimatedCard` layout that completely ignores:
  - `order.deliveryType`
  - `order.deliveryTimeSlot`
  - BNGL / Scheduled badges
  - left-border color accents

So even if backend classification is correct, both cards in **Other Orders** will still look almost the same.

### Root cause
There are currently **two different card UIs** on Home:
1. `OrderCard` for nearby orders → type-aware
2. Inline custom card for other orders → not type-aware

That is why your regular order and Book Now Get Later order are showing the same UI in the screenshot.

### Fix approach
1. **Unify the Home card UI**
   - Update `src/pages/Home.tsx` so **Other Orders** also use `OrderCard`
   - Pass the same props already used for Nearby Orders

2. **Keep type styling consistent**
   - Reuse the existing logic from `OrderCard` so BNGL shows:
     - amber left border
     - amber “Book Now Get Later” badge
   - Regular orders stay default

3. **Optional clarity improvement**
   - Add an explicit neutral **“Regular”** badge in `OrderCard`
   - This makes the difference obvious even when regular has no colored border

### Files to change
1. `src/pages/Home.tsx`
   - Replace the custom “Other Orders” card markup with `OrderCard`
2. `src/components/order/OrderCard.tsx`
   - Optional: add a small “Regular” badge for immediate orders

### Expected result
```text
Home → Other Orders

Regular order:
- normal card
- optionally “Regular” badge

Book Now Get Later order:
- amber left border
- amber “Book Now Get Later” badge
```

### Technical note
The current backend/type logic may already be correct for this specific issue. The visible problem in your screenshot is mainly that **Other Orders UI is not using the delivery-type-aware component at all**.
