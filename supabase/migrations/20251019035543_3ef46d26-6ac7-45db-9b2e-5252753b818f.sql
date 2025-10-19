-- Disable the problematic trigger that causes race conditions
-- We'll handle delivery_history creation explicitly in the edge function instead
DROP TRIGGER IF EXISTS create_delivery_history_on_delivered ON orders;

-- Keep the function in case we need it for manual operations
-- But it won't auto-trigger anymore
COMMENT ON FUNCTION create_delivery_history_entry() IS 'Legacy function - not auto-triggered. Use edge function for delivery completion.';