
Goal: stop the false redirect to “Upload Documents” after refresh on Android Studio WebView.

What I found from your current code:
1) `src/store/auth.ts` now waits for `fetchProfile()` during `INITIAL_SESSION`, but only up to 4 seconds.
2) If that 4s race times out, `loading` becomes `false` even when profile is still unknown.
3) Both `Splash` and `RequireApproval` treat `!profile` as “documents not submitted” and redirect to `/upload-documents`.
4) On Android WebView, profile fetch can be slower/intermittent on cold refresh, so this produces a wrong redirect even though the user is actually authenticated and approved.

So the bug is now a state-model issue:
- Current model: `profile === null` means both “not loaded yet” and “really missing”.
- Needed model: separate “profile is still resolving” from “profile resolved and missing/incomplete”.

Implementation plan (safe, minimal-risk, production pattern):

1. Add explicit profile resolution state in auth store
- File: `src/store/auth.ts`
- Add a new state field (example): `profileState: 'idle' | 'loading' | 'ready' | 'missing' | 'error'`.
- Keep existing `loading` for auth/session hydration only.
- This avoids using `profile === null` as a timing signal.

2. Refactor `fetchProfile()` to return deterministic outcomes
- File: `src/store/auth.ts`
- Before request: set `profileState = 'loading'`.
- On success with row: set `profile`, `profileState = 'ready'`.
- If no row (PostgREST no-row case): set `profile = null`, `profileState = 'missing'`.
- On transient/network error: set `profileState = 'error'` (do not immediately classify user as “upload documents”).
- Add precise debug logs for Android refresh traces.

3. Adjust `INITIAL_SESSION` completion logic
- File: `src/store/auth.ts`
- For authenticated session on boot:
  - Wait for first profile attempt to settle (with timeout guard), but if timeout occurs, keep profile as unresolved (`loading`/`error`) rather than treating it as missing.
- Ensure auth `loading` is turned off only when session state is known; profile resolution state remains separate and can continue/retry safely.

4. Update route guards to avoid redirecting on unresolved profile
- Files:
  - `src/components/auth/RequireApproval.tsx`
  - `src/pages/Splash.tsx`
- New behavior:
  - If auth is loading: show skeleton/splash (unchanged).
  - If authenticated but `profileState` is `idle/loading/error`: keep waiting UI (or retry UI), do NOT redirect to upload.
  - Redirect to `/upload-documents` only when profile is definitively resolved as:
    - `profileState === 'missing'`, or
    - `profileState === 'ready'` and `documents_submitted === false`.
- This removes false negatives during slow refresh.

5. Add self-correcting redirect logic in Upload Documents page
- File: `src/pages/UploadDocuments.tsx`
- If user lands there but profile later resolves as submitted/pending/approved/rejected/deactivated, auto-redirect to the correct page.
- This is a defensive layer so temporary misrouting cannot trap users.

6. Add lightweight retry for profile fetch on refresh
- File: `src/store/auth.ts`
- On `profileState='error'` during initial boot, do one delayed retry (e.g., 1–2s) before surfacing failure UI.
- Keeps experience resilient on flaky Android network initialization.

Validation plan (must pass before closing):
1) Android Studio cold start while logged in → should stay in app flow, no jump to upload.
2) Pull-to-refresh / WebView refresh on `/home` and `/my-deliveries` → remains authenticated and approved route.
3) Slow network simulation → no false upload redirect; waits and then routes correctly.
4) Real incomplete profile user → still correctly goes to `/upload-documents`.
5) Service worker still bypasses Supabase requests (already fixed) and no auth regression.

Technical note:
No database migration needed. This is frontend auth-state modeling and guard behavior only.
