
## Root cause

The `verify_delivery_otp` RPC writes to `public.otp_verification_attempts` with columns `user_id, success, attempted_at`, but that table's actual schema is phone-based (`phone, otp_id, attempt_count, last_attempt_at, created_at`) — it belongs to a different OTP feature. Every INSERT/SELECT in the RPC fails with "column user_id does not exist".

Confirmed via schema check:
- `orders.user_id` ✅ exists
- `otp_verification_attempts.user_id` ❌ missing (only `phone`, `otp_id`, …)

## Fix (single migration)

Create a dedicated `public.delivery_otp_attempts` table for delivery-OTP rate limiting and rewrite `verify_delivery_otp` to use it. Leaves the existing phone-based `otp_verification_attempts` table untouched so the other feature keeps working.

### Migration contents

1. `CREATE TABLE public.delivery_otp_attempts` — `user_id uuid not null`, `order_id uuid`, `success bool not null`, `attempted_at timestamptz not null default now()`, plus index on `(user_id, attempted_at desc)`.
2. `GRANT` block: `service_role` full access; no `anon`/`authenticated` grants (only the SECURITY DEFINER RPC reads/writes it).
3. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + a deny-all-to-clients policy (empty policy set is effectively deny; add an explicit `service_role`-only comment for clarity).
4. `CREATE OR REPLACE FUNCTION public.verify_delivery_otp(...)` — same signature `(p_order_id uuid, p_otp text, p_agent_id uuid default null)`, same return shape, but reads/writes `delivery_otp_attempts`. Also records `order_id` on each attempt. Keeps the "already verified / delivered" short-circuit, the 5-fail 15-minute lockout, and `attempts_remaining` in the response.

No frontend changes needed — response shape (`success`, `message`, `locked`, `attempts_remaining`) is unchanged, so `DeliveryOtpDialog` keeps working as-is.

## Out of scope

- No changes to `otp_verification_attempts` (phone-OTP feature).
- No changes to `profiles.delivery_otp` or the customer app.
- No historical backfill.
