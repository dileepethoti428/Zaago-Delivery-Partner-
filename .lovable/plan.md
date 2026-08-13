# Fix missing compensation deliveries

## Confirmed root cause

The pending Onion compensation exists, but `vacation_compensations.assigned_agent_id` contains Dileep's internal `delivery_agents.id` (`c4b29233-…`), while the compensation RPCs compare that value directly with his signed-in auth UUID (`17578977-…`). The comparison can never match, so the fetch returns no row and completion would also fail.

The record was scheduled for 12 Aug 2026, while today is 13 Aug 2026 IST. The current exact-date query would therefore hide it even after correcting the identity mapping. The frontend also does not include compensation-query loading/errors in the page state, so an RPC failure looks like an empty list.

## What to change

1. Update `get_agent_compensations` to resolve the signed-in user's `delivery_agents.id` and match compensation assignments stored in the existing internal-ID format.
2. For the Today request, return all pending compensations whose delivery date is today or overdue, so missed pending work remains visible until delivered or cancelled. Tomorrow remains exact-date only.
3. Apply the same resolved-agent ownership check in `complete_agent_compensation`, including its already-completed check.
4. Include compensation query loading and errors in the Orders page state instead of silently reporting zero results.
5. Keep the subscription slot (`evening-early` for this order), amber Compensation badge, original missed date, and dedicated “Mark as Delivered” action.
6. After completion, update/remove the compensation from the React Query cache so it disappears immediately without a broad render-storm invalidation.

## Verification

- Query the RPC as Dileep's auth identity and confirm the overdue Onion compensation is returned in Today with its evening slot.
- Confirm it appears under Today → Evening and Today → All.
- Confirm marking it delivered updates only `vacation_compensations`, then removes it from the pending list.
- Run the relevant checks and verify the Orders screen at mobile size.
