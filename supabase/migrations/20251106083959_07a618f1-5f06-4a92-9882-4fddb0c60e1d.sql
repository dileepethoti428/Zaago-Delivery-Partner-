-- Fix delivery data and add missing earnings record
-- There are two delivery_history records, one with invalid agent_id

-- Step 1: Delete the incorrect delivery_history record (invalid agent_id with 0 payout)
DELETE FROM delivery_history 
WHERE order_id = '3e5c3f90-d836-48f3-a7b4-d4a3c29b682c' 
  AND agent_id = '17578977-5353-46fd-8ba0-9d2c058adcec';

-- Step 2: Update the order to use the correct agent_id
UPDATE orders 
SET agent_id = 'c4b29233-d15c-497c-ad01-4c5238be2b4e'
WHERE id = '3e5c3f90-d836-48f3-a7b4-d4a3c29b682c';

-- Step 3: Insert the earnings tracking record with the correct agent_id
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