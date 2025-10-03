-- Step 1: Remove duplicate records, keeping only the most recent one
DELETE FROM user_purchase_history
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, product_id, order_id) id
  FROM user_purchase_history
  ORDER BY user_id, product_id, order_id, purchased_at DESC
);

-- Step 2: Now add the unique constraint
ALTER TABLE user_purchase_history 
ADD CONSTRAINT user_purchase_history_unique_constraint 
UNIQUE (user_id, product_id, order_id);

-- Log the fix
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'added_unique_constraint_to_user_purchase_history',
    'issue', 'ON CONFLICT clause was failing due to missing unique constraint',
    'duplicates_removed', (SELECT COUNT(*) FROM user_purchase_history) - (SELECT COUNT(DISTINCT (user_id, product_id, order_id)) FROM user_purchase_history),
    'fixed_at', now()
  )
);