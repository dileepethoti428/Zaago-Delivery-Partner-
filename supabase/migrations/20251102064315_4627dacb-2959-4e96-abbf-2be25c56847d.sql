-- Backfill missing agent_id values in agent_documents table
-- This links agent_documents to delivery_agents using the user_id
UPDATE agent_documents ad
SET agent_id = da.id, 
    updated_at = now()
FROM delivery_agents da
WHERE ad.user_id::text = da.agent_id
  AND ad.agent_id IS NULL;