-- Step 1: Convert non-UUID agent_id values to UUID format
UPDATE delivery_agents 
SET agent_id = gen_random_uuid()::text
WHERE agent_id NOT LIKE '%-%-%-%-%';

-- Step 2: Drop the CHECK constraint that uses regex on agent_id
ALTER TABLE delivery_agents DROP CONSTRAINT IF EXISTS valid_agent_id_format;

-- Step 3: Drop ALL RLS policies that depend on delivery_agents.agent_id
DROP POLICY IF EXISTS "Users can create their own agent profile" ON delivery_agents;
DROP POLICY IF EXISTS "Agents can insert their own delivery records" ON delivery_history;
DROP POLICY IF EXISTS "Agents can update their own delivery records" ON delivery_history;
DROP POLICY IF EXISTS "Agents can view only their own delivery history" ON delivery_history;
DROP POLICY IF EXISTS "Active agents can view their own metrics" ON delivery_metrics;
DROP POLICY IF EXISTS "Active agents can manage their own routes" ON delivery_routes;
DROP POLICY IF EXISTS "Active agents can manage their own location" ON driver_locations;
DROP POLICY IF EXISTS "Delivery agents can view and scan QR codes" ON order_qr_codes;
DROP POLICY IF EXISTS "Agents can insert their own rejections" ON order_rejections;
DROP POLICY IF EXISTS "Agents can view their own rejections" ON order_rejections;
DROP POLICY IF EXISTS "Active agents can manage tracking for assigned orders" ON order_tracking;
DROP POLICY IF EXISTS "Agents can update their assigned orders" ON orders;
DROP POLICY IF EXISTS "Delivery agents can view available orders" ON orders;
DROP POLICY IF EXISTS "Agents can insert their own work sessions" ON agent_work_sessions;
DROP POLICY IF EXISTS "Agents can update their own work sessions" ON agent_work_sessions;
DROP POLICY IF EXISTS "Agents can view their own work sessions" ON agent_work_sessions;

-- Step 4: Drop the incorrect foreign key (it's broken anyway)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_agent_id_fkey;

-- Step 5: Convert delivery_agents.agent_id from TEXT to UUID
ALTER TABLE delivery_agents 
ALTER COLUMN agent_id TYPE uuid USING agent_id::uuid;

-- Step 6: Recreate all 16 RLS policies with UUID type
CREATE POLICY "Users can create their own agent profile" ON delivery_agents
FOR INSERT
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can insert their own delivery records" ON delivery_history
FOR INSERT
WITH CHECK (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can update their own delivery records" ON delivery_history
FOR UPDATE
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can view only their own delivery history" ON delivery_history
FOR SELECT
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Active agents can view their own metrics" ON delivery_metrics
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email()) 
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Active agents can manage their own routes" ON delivery_routes
FOR ALL
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
)
WITH CHECK (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Active agents can manage their own location" ON driver_locations
FOR ALL
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
)
WITH CHECK (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Delivery agents can view and scan QR codes" ON order_qr_codes
FOR ALL
USING (
  order_id IN (
    SELECT orders.id
    FROM orders
    JOIN delivery_agents ON orders.agent_id = delivery_agents.agent_id
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can insert their own rejections" ON order_rejections
FOR INSERT
WITH CHECK (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can view their own rejections" ON order_rejections
FOR SELECT
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Active agents can manage tracking for assigned orders" ON order_tracking
FOR ALL
USING (
  order_id IN (
    SELECT orders.id
    FROM orders
    JOIN delivery_agents ON orders.agent_id = delivery_agents.agent_id
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can update their assigned orders" ON orders
FOR UPDATE
USING (
  agent_id IN (
    SELECT delivery_agents.agent_id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Delivery agents can view available orders" ON orders
FOR SELECT
USING (
  (status IN ('open', 'new', 'packed')) 
  OR (agent_id IN (
    SELECT delivery_agents.agent_id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  ))
);

CREATE POLICY "Agents can insert their own work sessions" ON agent_work_sessions
FOR INSERT
WITH CHECK (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can update their own work sessions" ON agent_work_sessions
FOR UPDATE
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);

CREATE POLICY "Agents can view their own work sessions" ON agent_work_sessions
FOR SELECT
USING (
  agent_id IN (
    SELECT delivery_agents.id
    FROM delivery_agents
    WHERE (delivery_agents.agent_id = auth.uid() OR delivery_agents.email = auth.email())
      AND delivery_agents.is_active = true
  )
);