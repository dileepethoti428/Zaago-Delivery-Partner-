## Root Cause (confirmed)

I called the deployed `update-agent-location` directly with `{latitude, longitude}` and got back:

```
500 {"success":false,"error":"Missing required fields: agent_id, latitude, longitude"}
```

That response shape (`error` field, HTTP 500, requiring `agent_id` in body) belongs to a **very old version** of the function. The current repo code (`supabase/functions/update-agent-location/index.ts`, v5) doesn't require `agent_id`, derives the user from the JWT, and returns `success:false, reason:...` at HTTP 200.

Every previous "redeploy" of this function appeared to succeed but the old build kept serving. The reason is almost certainly the top-level import:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
```

`esm.sh` floating imports intermittently fail to resolve during Supabase edge-runtime compilation. When the new build fails, the platform keeps serving the last-good older build — which is why "Save Location" works some times (cached) and fails other times, and why our redeploys never actually replaced the code.

The "works sometimes" behaviour is not a client-side race — the client always sends `{latitude, longitude}`; there's no code path anywhere in the repo that sends `agent_id`. It's purely which build of the function happens to be alive at that moment.

## Fix

**File:** `supabase/functions/update-agent-location/index.ts`

Replace the esm.sh import with the npm specifier (stable, no drift):

```ts
// before
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
// after
import { createClient } from 'npm:@supabase/supabase-js@2';
```

No other logic changes — the v5 auth-from-JWT flow is already correct.

Then:
1. Deploy `update-agent-location` via `supabase--deploy_edge_functions`.
2. Verify with `supabase--curl_edge_functions` that POST `{latitude, longitude}` (no `agent_id`) no longer returns the "Missing required fields" 500 — the new build responds with `success:true` (or a proper `soft-fail` 200 like `invalid_token` when unauthenticated).
3. Tail `supabase--edge_function_logs` for `update-agent-location` and confirm the `Missing required fields` line stops appearing.

## Why this fixes the intermittency

Once the function is running the v5 build, every call succeeds because the client already sends the right payload. There is no other place in the codebase that could produce this error message — it exists only in the stale deployed build.

No frontend, DB, or other function changes are needed.