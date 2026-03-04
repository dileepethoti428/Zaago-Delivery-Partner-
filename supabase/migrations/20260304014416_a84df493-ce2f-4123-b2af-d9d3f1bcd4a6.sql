
DROP POLICY IF EXISTS "Agents can view own earnings tracking" ON agent_earnings_tracking;

CREATE POLICY "Agents can view own earnings tracking"
ON agent_earnings_tracking FOR SELECT
USING (
  agent_id IN (
    SELECT id FROM delivery_agents WHERE agent_id = auth.uid()
  )
);
