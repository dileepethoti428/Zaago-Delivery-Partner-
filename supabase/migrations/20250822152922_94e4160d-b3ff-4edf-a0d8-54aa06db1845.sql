-- Enable real-time updates for delivery_history table
ALTER TABLE delivery_history REPLICA IDENTITY FULL;

-- Add delivery_history to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_history;