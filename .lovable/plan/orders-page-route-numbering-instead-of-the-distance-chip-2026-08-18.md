# Orders page: route numbering instead of the distance chip

## What changes

On the Orders (My Deliveries) cards, the small chip that currently reads "50m" becomes a route sequence number: `#1`, `#2`, `#3`… following the existing nearest-first sort order, so the rider can follow the list as a route.

The distance itself stays available (shown as a smaller secondary text next to the address), and it is measured from the seller's shop to the customer's delivery point.

## Why "50m" shows today

The card already computes seller → customer distance, but many orders fall back to coordinates that are nearly identical (the seller location and the customer location resolve to almost the same point), which produces the tiny 50m value. As part of this change I will verify the seller and customer coordinates for the two orders shown in the screenshot before trusting the displayed value, and if the seller coordinates are missing/duplicated, the card will show no distance rather than a misleading 50m.

## Technical details

- `src/pages/MyDeliveries.tsx`: after the existing `sortByDistance` pass, stamp each order with its 1-based `routeIndex` so numbering matches the rendered order; pass it to the card. Re-number per tab (Today / Tomorrow / All) and after the morning/evening filter is applied, so numbers are always contiguous starting at #1. Delivered tab gets no numbering.
- `src/components/order/AssignedOrderCard.tsx`: replace the `MapPin` distance badge in the header with a `#N` badge; render the distance as muted text under the address only when a valid seller→customer distance exists.
- Sanity-check the coordinate data with a read-only query on the affected orders to confirm whether the ~50m values are real or a coordinate fallback artifact.
