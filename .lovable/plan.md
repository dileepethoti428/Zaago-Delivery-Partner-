## Problem

On the Delivered tab, the page shows "No evening orders / No deliveries scheduled for this evening" even though 4 delivered orders exist (Delivered (4)).

## Root cause

In `src/pages/MyDeliveries.tsx`, the time-of-day filter UI is hidden for the Delivered tab, but the underlying `timeFilter` state still applies to the list via `timeFilteredOrders`. Since the default bucket is auto-picked from current time (e.g. "evening"), delivered orders whose `deliveryTimeSlot` doesn't match get filtered out — producing the wrong empty state and hiding real delivered orders.

## Fix

In `src/pages/MyDeliveries.tsx`:

1. Bypass the time filter when `dateFilter === 'delivered'` — `timeFilteredOrders` should return `currentOrders` as-is for that tab.
2. In the "search/time filter returned nothing" empty state, guard the morning/evening branches so they only render when `dateFilter !== 'delivered'`. For delivered with no rows, fall back to the standard delivered empty message ("No deliveries completed today").

No backend or other component changes needed.
