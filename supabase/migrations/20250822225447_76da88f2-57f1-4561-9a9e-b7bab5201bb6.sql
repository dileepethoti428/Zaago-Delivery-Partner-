-- Create a table to prevent agents from seeing orders they cancelled
create table if not exists public.order_exclusions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  agent_id uuid not null references public.delivery_agents(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (order_id, agent_id)
);

-- Helpful index
create index if not exists idx_order_exclusions_agent_order
  on public.order_exclusions(agent_id, order_id);

-- Enable RLS for safety (not strictly needed for our edge function which uses service role)
alter table public.order_exclusions enable row level security;