-- Backfill missing earnings record for delivery completed today
-- Using correct delivery_agents.id (primary key) not agent_id field

INSERT INTO agent_earnings_tracking (
  agent_id,
  order_id,
  expected_payout,
  actual_payout,
  payout_status,
  accepted_at,
  completed_at,
  payment_method,
  distance_km,
  is_peak_hour,
  payout_breakdown,
  created_at,
  updated_at
)
VALUES (
  'c4b29233-d15c-497c-ad01-4c5238be2b4e',
  '3e5c3f90-d836-48f3-a7b4-d4a3c29b682c',
  25.00,
  25.00,
  'confirmed',
  '2025-11-06 06:55:28.688+00',
  '2025-11-06 07:55:51.095751+00',
  'ONLINE',
  2.5,
  false,
  '{"base_pay": 27, "distance_pay": 11, "peak_bonus": 0, "platform_fee": 13}'::jsonb,
  '2025-11-06 07:55:51.095751+00',
  '2025-11-06 07:55:51.095751+00'
)
ON CONFLICT (order_id) DO NOTHING;