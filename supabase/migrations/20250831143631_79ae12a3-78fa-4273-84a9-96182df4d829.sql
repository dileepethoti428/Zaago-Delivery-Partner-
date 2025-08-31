-- Enable realtime for orders table
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE orders;