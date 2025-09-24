-- Add pickup location fields to orders table for two-stage delivery
ALTER TABLE public.orders 
ADD COLUMN pickup_location jsonb,
ADD COLUMN pickup_address text,
ADD COLUMN pickup_status text DEFAULT 'pending',
ADD COLUMN seller_name text,
ADD COLUMN seller_phone text;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.pickup_location IS 'Seller location data including coordinates for pickup';
COMMENT ON COLUMN public.orders.pickup_address IS 'Formatted address of pickup location (seller/restaurant)';
COMMENT ON COLUMN public.orders.pickup_status IS 'Status of pickup: pending, going_to_pickup, at_pickup, picked_up';
COMMENT ON COLUMN public.orders.seller_name IS 'Name of seller/restaurant for pickup identification';
COMMENT ON COLUMN public.orders.seller_phone IS 'Phone number of seller for pickup coordination';