

## Fix: Redeploy `update-agent-location` edge function

### Root cause
The deployed version of `update-agent-location` is an older variant that requires `agent_id` in the request body and throws `"Missing required fields: agent_id, latitude, longitude"` (logs confirm this at line 22 of the deployed file). The frontend correctly sends only `{ latitude, longitude, accuracy }` and relies on the JWT to identify the agent — matching the canonical version already present in the repo (`supabase/functions/update-agent-location/index.ts`), which derives `userId` from `auth.getUser()`.

The repo and the deployment are out of sync.

### Fix
Redeploy `supabase/functions/update-agent-location/index.ts` (already correct in the repo — JWT-based, soft-fail design, never throws on missing agent_id) so the live function matches the code.

No code changes needed — just a redeploy of the existing file.

### Result
- "Save My Location" button on Profile will succeed.
- Background `useLocationSyncController` syncs will stop logging soft-fail noise from the mismatched contract.

