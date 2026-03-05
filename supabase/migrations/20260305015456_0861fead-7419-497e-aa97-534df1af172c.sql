
INSERT INTO subscription_vacations (
  id, subscription_id, user_id, start_date, end_date,
  total_days, status, reason, credit_applied, created_at, updated_at
)
SELECT
  gen_random_uuid(), s.id, c.id,
  '2026-03-05'::date, '2026-03-10'::date,
  6, 'active', 'Customer requested vacation', false, now(), now()
FROM subscriptions s
JOIN customers c ON c.id = s.customer_id
WHERE c.full_name ILIKE '%siva%'
  AND s.status = 'active'
  AND s.end_date >= '2026-03-05'
LIMIT 1;
