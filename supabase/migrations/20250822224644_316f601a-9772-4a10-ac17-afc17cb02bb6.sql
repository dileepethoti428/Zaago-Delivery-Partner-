-- Enable real-time updates for the orders table
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add the orders table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;