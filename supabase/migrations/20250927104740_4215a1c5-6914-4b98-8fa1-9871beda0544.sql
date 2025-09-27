-- Add agent_notification_sent column to orders table if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_notification_sent BOOLEAN DEFAULT false;

-- Ensure the column has proper default value for existing orders
UPDATE orders SET agent_notification_sent = false WHERE agent_notification_sent IS NULL;