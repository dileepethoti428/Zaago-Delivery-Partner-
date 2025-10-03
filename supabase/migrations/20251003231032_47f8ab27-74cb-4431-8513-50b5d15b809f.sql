-- Add payment_method column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT 
CHECK (payment_method IN ('COD', 'ONLINE'));

-- Backfill existing orders with payment_method based on payment_status
UPDATE orders 
SET payment_method = CASE 
  WHEN payment_status = 'paid_cod' THEN 'COD'
  WHEN payment_status = 'paid_online' THEN 'ONLINE'
  ELSE 'COD'
END
WHERE payment_method IS NULL;