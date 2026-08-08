# Manage Delivery: Swipe to Deliver + reworked bottom actions

## What changes
- Replace the "Delivered" tap button with a full-width **Swipe right to Deliver** track (same component/feel as the swipe-to-accept on the home page).
- Move the actions row below the swipe track: **Customer** (navigate) on the left half and **Cancel Delivery** on the right half, each 50% width.
- Cancel Delivery keeps its red destructive styling; Customer keeps the outline style with the navigation icon.
- Terminal states (delivered/cancelled) still show only the "Order Already Delivered / Order Closed" message — no swipe, no buttons.

## Layout
```text
[  ->   Swipe right to Deliver        ]
[  Customer      |   Cancel Delivery  ]
```

## Technical notes
- Generalize `src/components/order/SwipeToAccept.tsx` slightly (label + optional confirm-word emphasis) or reuse as-is with `label="Swipe right to Deliver"`; keep its existing loading/disabled handling so `isCompleting` / `isGeneratingQR` show the spinner state.
- In `src/pages/ManageDelivery.tsx`, the fixed bottom bar: swipe track calls the existing `handleMarkAsDelivered`; row below uses `flex gap-3` with `flex-1` on both buttons.
- No backend or business-logic changes; OTP / payment dialogs flow stays identical.
