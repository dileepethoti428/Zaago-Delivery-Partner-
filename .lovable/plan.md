# Why Poornima Reddy's order isn't showing for Dileep Ethoti

## What the data shows

- The subscription (Poornima Reddy, Onion 500g, Early Morning, next delivery 19-08-2026) is assigned to Dileep Ethoti — both `primary_agent_id` and `last_assigned_agent_id` point to his agent record.
- The actual delivery row for 19-08-2026 exists in `daily_orders` (status `pending`), but its `assigned_agent_id` is **empty**.
- The Orders page "Tomorrow" list only returns rows where `assigned_agent_id` equals the logged-in partner's account ID. Empty means it belongs to nobody, so nothing shows.

So the assignment was recorded on the subscription, but never copied onto the day's delivery row.

## Second, related risk

The subscription stores the agent's **internal record ID**, while `daily_orders` stores the agent's **login account ID**. Every existing assigned row in `daily_orders` uses the login account ID. Any fix must translate between the two, otherwise the order still won't appear.

## Fix

1. **Backfill** — stamp the correct agent onto existing unassigned daily orders whose subscription already has an assigned agent (translating internal ID to login account ID). This immediately makes tomorrow's order visible to Dileep.
2. **Prevent recurrence** — add a database trigger on `daily_orders`: when a row is created for a subscription that has an assigned agent and no agent is set on the row, fill it in automatically with the translated login account ID.
3. **Keep in sync** — when a subscription's assigned agent is changed or removed, propagate that to its future (not yet delivered) daily orders, so "Change Agent" / "Remove Agent" in the seller app takes effect on the partner app.

## Technical notes

- Translation: `subscriptions.primary_agent_id` -> `delivery_agents.id` -> `delivery_agents.agent_id` (auth UUID) used by `daily_orders.assigned_agent_id`.
- Trigger: `BEFORE INSERT OR UPDATE OF subscription_id ON public.daily_orders`, security definer, `search_path = public`.
- Sync trigger: `AFTER UPDATE OF primary_agent_id ON public.subscriptions`, updating `daily_orders` where `date >= current IST date` and status in (`pending`, `assigned`).
- Handle the case where `primary_agent_id` already holds an auth UUID (fall back to matching on `delivery_agents.agent_id` too).
- No frontend changes needed; `get_agent_orders_today/tomorrow/upcoming` already filter on `assigned_agent_id = auth.uid()`.
