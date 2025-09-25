-- Update payout configuration for delivery agents
UPDATE payout_config 
SET 
  base_pay_amount = 12.00,           -- ₹12 for first 1km
  base_pay_distance_km = 1.0,        -- First 1km
  per_km_min_rate = 8.00,            -- ₹8 per km after 1km
  per_km_max_rate = 8.00,            -- Keep it consistent at ₹8 per km
  updated_at = now()
WHERE is_active = true;

-- If no active config exists, create one
INSERT INTO payout_config (
  base_pay_amount,
  base_pay_distance_km, 
  per_km_min_rate,
  per_km_max_rate,
  peak_hour_start,
  peak_hour_end,
  peak_hour_order_threshold,
  peak_hour_bonus_amount,
  is_active
)
SELECT 
  12.00,                             -- ₹12 for first 1km
  1.0,                               -- First 1km
  8.00,                              -- ₹8 per km after 1km
  8.00,                              -- ₹8 per km after 1km
  '06:00:00'::time,                  -- Peak hour start
  '12:00:00'::time,                  -- Peak hour end
  14,                                -- Peak hour order threshold
  80.00,                             -- Peak hour bonus
  true                               -- Active config
WHERE NOT EXISTS (
  SELECT 1 FROM payout_config WHERE is_active = true
);