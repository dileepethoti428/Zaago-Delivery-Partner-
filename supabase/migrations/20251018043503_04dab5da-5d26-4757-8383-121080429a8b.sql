-- Add OTP column to orders table for delivery verification
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6);

-- Add index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_orders_delivery_otp ON orders(delivery_otp) 
WHERE delivery_otp IS NOT NULL;