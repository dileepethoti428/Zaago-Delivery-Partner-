-- Disable the track_purchase_history trigger that causes race conditions
-- We'll handle purchase history tracking explicitly in the edge function instead
DROP TRIGGER IF EXISTS track_purchase_history_trigger ON orders;

-- Keep the function for potential manual use
COMMENT ON FUNCTION track_purchase_history() IS 'Legacy function - not auto-triggered. Use edge function for purchase tracking.';