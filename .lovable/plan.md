
## Plan: Add "View More" Button to MyDeliveries Page

### What needs changing

`src/pages/MyDeliveries.tsx` currently renders **all** `filteredOrders` at once. With 40 subscription orders this is a long, heavy list with no pagination.

### Approach

Add a `visibleCount` state (default 5) that resets when the tab changes. Slice `filteredOrders` to `visibleCount` for rendering. Show a "View More" button below when there are more to show.

**Key detail**: When `search` is active, show **all** filtered results — no "View More" clutter when the agent is looking for a specific person. Only paginate the default (no search) view.

```text
State:    visibleCount = 5  (resets on tab change)

Render:   filteredOrders.slice(0, search ? filteredOrders.length : visibleCount)

Button:   shown only when !search && filteredOrders.length > visibleCount
          "View More (X remaining)" → visibleCount += 5
```

### Files to change
1. `src/pages/MyDeliveries.tsx`
   - Add `const [visibleCount, setVisibleCount] = useState(5)`
   - Reset `visibleCount` to 5 when tab changes (in the `onValueChange` handler)
   - Derive `displayedOrders = search ? filteredOrders : filteredOrders.slice(0, visibleCount)`
   - Render `displayedOrders` instead of `filteredOrders`
   - Add "View More" button below the list (same style as Delivery History — outline, ChevronDown icon)
   - Import `ChevronDown` and `Button` (Button already imported via AppShell context — need to check)

Need to also add `Button` import from `@/components/ui/button` and `ChevronDown` from `lucide-react`.
