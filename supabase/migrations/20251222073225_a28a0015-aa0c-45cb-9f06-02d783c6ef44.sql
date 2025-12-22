-- Add delivery_payout column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_payout NUMERIC DEFAULT 30;

-- Update existing orders without delivery_payout
UPDATE public.orders 
SET delivery_payout = 30 
WHERE delivery_payout IS NULL;