## Goals

1. Show **Total Working Hours** on Profile broken down by timeline (Today, Yesterday, 1 Week, 1 Month, All Time) — counted only when the agent is/was Online.
2. Add a **scrollbar** to the Recent Deliveries lists on the Earnings page in all three tabs (All, Regular, Subscription).

---

## 1. Working Hours Breakdown (Profile page)

### Data layer
- New SQL function `get_agent_work_hours_breakdown(agent_uuid uuid)` in a migration. Returns a JSON object:
  ```
  { today, yesterday, week, month, all_time }
  ```
  Computed from `agent_work_sessions` (the same source today's `get_agent_total_hours` uses, so it already reflects "online time only").
  - For each window, sum `total_hours` of sessions whose `session_start` falls in the window.
  - For an open session (`session_end IS NULL`), add the live elapsed slice that overlaps each window so Today keeps ticking while Online.
  - "Yesterday" = the previous calendar day (IST timezone, matching how the rest of the app reports dates).

### Hook
- Replace `useWorkHours` return shape with `{ today, yesterday, week, month, allTime }` (still keyed by `userId`, still polls every 60s when `isOnline`).
- Keep `formatHours` helper as-is.

### UI (`src/pages/Profile.tsx`)
- Replace the single "Total Working Hours" row with a card that contains 5 small rows, each showing label + formatted hours:
  - Today
  - Yesterday
  - This Week
  - This Month
  - All Time
- Keep the existing helper text ("Counting while online / Resumes when you go online") at the top of the card.
- Use existing semantic tokens (`bg-muted/50`, `text-foreground`, `text-muted-foreground`, `tabular-nums`). No new colors.

---

## 2. Scrollable Recent Deliveries (Earnings page)

Files: `src/components/earnings/RecentEarningsList.tsx` and `src/components/earnings/SubscriptionDeliveryList.tsx`.

- Wrap the list rows (the inner `space-y-3` container that maps over visible items) in a scrollable region:
  - `max-h-[420px] overflow-y-auto pr-1` so a native scrollbar appears once the list exceeds the cap.
  - Keep the existing **View More / View Less** buttons just below the scroll area (outside the scroll container) so they remain reachable.
- No changes to data fetching, pagination logic, or the empty state.
- Applies to all three Earnings tabs because:
  - "All" tab uses `RecentEarningsList` directly.
  - "Regular" tab uses `RecentEarningsList` via `EarningsTabContent`.
  - "Subscription" tab uses `SubscriptionDeliveryList` via `SubscriptionTabContent`.

---

## Technical details

- New migration adds the breakdown RPC with `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, granted to `authenticated, anon` (matching the existing `get_agent_total_hours` function). No table or RLS changes.
- `useWorkHours` switches from `.rpc('get_agent_total_hours')` (number) to `.rpc('get_agent_work_hours_breakdown')` (json). Keeps the same `delivery_agents.id` resolution path from `agent_id = userId`.
- After the migration is approved, `src/integrations/supabase/types.ts` is regenerated automatically — no manual edit.
- Scrollbar uses Tailwind utilities only; no custom scrollbar styling needed.
