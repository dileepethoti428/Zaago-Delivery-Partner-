## Root cause

The deployed `update-agent-location` edge function is an older version that requires `agent_id`, `latitude`, `longitude` in the request body and throws at line 22 when `agent_id` is missing.

The current repo version (`supabase/functions/update-agent-location/index.ts`) is the "v5 never-fail" implementation that:
- Extracts the user from the JWT (`Authorization` header)
- Looks up the agent in `delivery_agents` by `agent_id = userId`
- Only needs `latitude` and `longitude` in the body

All frontend callers (Profile "Save Location", `useLocationSyncController`, `postAuthInit`) already match the repo version and send only `latitude`/`longitude`/`accuracy`. The deployed function has simply drifted from the repo and was never re-deployed.

Confirming this is the issue: the same error appears in logs every ~15 seconds (the LocationSync watcher interval), not only when the user clicks Save Location.

## Fix

Force a redeploy of the `update-agent-location` edge function so the deployed version matches the repo's v5 code. No code changes are required.

Steps (build mode):
1. Run `supabase--deploy_edge_functions` for `["update-agent-location"]`.
2. Click "Save Location" on the Profile page and verify success toast.
3. Confirm via `supabase--edge_function_logs` that the "Missing required fields" error no longer appears and is replaced by the v5 success logs (`✓ Authenticated user`, `✓ delivery_agents updated`).

## What we will NOT change

- No edits to `Profile.tsx`, `useLocationSyncController.ts`, `postAuthInit.ts`, or `supabase/functions/update-agent-location/index.ts` — the repo is already correct.
- No DB / RLS changes.
