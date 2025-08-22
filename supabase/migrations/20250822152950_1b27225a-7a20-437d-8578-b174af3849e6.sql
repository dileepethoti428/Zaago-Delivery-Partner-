-- Enable full replica identity for delivery_history table to capture complete row data
ALTER TABLE delivery_history REPLICA IDENTITY FULL;