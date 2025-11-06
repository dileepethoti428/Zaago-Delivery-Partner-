-- Step 1: Reassign the specific problematic order to the correct agent
UPDATE orders 
SET agent_id = 'f37deb4f-45d9-4ea7-964c-084b3c60e533'
WHERE id = '0752c78d-58d4-4bf9-bf90-4d83c069e068'
  AND agent_id = '17578977-5353-46fd-8ba0-9d2c058adcec';

-- Step 2: Clean up any other orders with invalid agent assignments
-- Set agent_id to NULL for orders assigned to non-existent agents
-- Reset status to 'accepted' (the status before assignment)
UPDATE orders
SET agent_id = NULL,
    status = CASE 
      WHEN status = 'assigned' THEN 'accepted'
      ELSE status
    END
WHERE agent_id IS NOT NULL
  AND agent_id NOT IN (SELECT id FROM delivery_agents);

-- Step 3: Add foreign key constraint to prevent future invalid assignments
-- First, ensure all current agent_ids are valid (already done in step 2)
-- Then add the constraint with ON DELETE SET NULL to handle agent deletions gracefully
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_agent_id_fkey;

ALTER TABLE orders
ADD CONSTRAINT orders_agent_id_fkey 
FOREIGN KEY (agent_id) 
REFERENCES delivery_agents(id) 
ON DELETE SET NULL;

-- Step 4: Add index for better performance on agent_id lookups
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id) WHERE agent_id IS NOT NULL;