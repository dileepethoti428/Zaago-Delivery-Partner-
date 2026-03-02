
Issue diagnosis from current code and logs:
1. Login is succeeding at auth level (`[Auth] State change: SIGNED_IN` appears), so credentials are valid.
2. The spinner gets stuck because `src/pages/Login.tsx` does `await fetchProfile()` without a protective timeout/finally path. If that promise hangs or throws, `setLoading(false)` is never reached.
3. `fetchProfile` in `src/store/auth.ts` currently treats all `profileRes.error` cases as “missing profile”, which can convert transient/network/API errors into wrong routing state.
4. Login page redirect logic only navigates when `session && profile`; it does not handle “session exists but profile still resolving/error”, so users can remain on login screen even after successful sign-in.
5. The Tailwind CDN warning in `lovable.js` is non-blocking and not the cause of login hang.

Implementation approach (safe, minimal, production-focused):

1) Harden login submit flow so spinner cannot get stuck
- File: `src/pages/Login.tsx`
- Refactor `handleLogin` into `try/catch/finally` so `setLoading(false)` is guaranteed.
- Add a bounded wait around profile loading during login:
  - `Promise.race([fetchProfile(), timeout])` (example 6–8s).
- If profile fetch times out/fails, do not keep user on endless spinner; route to `/splash` so central auth/profile retry logic continues there.
- Keep non-blocking tasks (`ensureAgentExists`, location sync, FCM) fire-and-forget.

2) Apply same safety to signup flow
- File: `src/pages/Login.tsx`
- `handleSignup` also uses `await fetchProfile()` without robust timeout/finally.
- Mirror the same timeout/finally pattern so signup never leaves button spinning forever.

3) Make Login redirect state-aware (not profile-object-only)
- File: `src/pages/Login.tsx`
- Extend redirect effect to use `profileState`:
  - If `session` exists and `profileState` is `idle/loading/error`, navigate to `/splash` (or show local loading state) instead of staying on login form.
  - Route to `/upload-documents` only when state is definitively `missing` or ready with `documents_submitted=false`.
  - Route approved/pending/rejected/deactivated as today.
- This prevents “already signed in but still seeing login”.

4) Fix profile error classification in auth store
- File: `src/store/auth.ts`
- In `fetchProfile`, distinguish between:
  - True “no row” case (`PGRST116` with `.single()`) => `profileState='missing'`
  - Other errors (network/RLS/5xx/timeout) => `profileState='error'` and throw
- Keep current success path (`profileState='ready'`) unchanged.
- This prevents false “missing profile” state and wrong redirects.

5) Preserve idempotence and avoid regressions
- File: `src/store/auth.ts`
- Keep the existing access_token equality guard intact (already preventing duplicate session churn).
- Do not change current listener registration order or initialization guards; only strengthen failure handling.

6) UX feedback improvements for poor network during login
- File: `src/pages/Login.tsx`
- On profile timeout after successful sign-in, show a friendly toast such as:
  - “Signed in. Loading your account details…”
- Then route to `/splash` for recovery retries.
- This reduces perceived failure during slow Android WebView conditions.

Validation plan after implementation:
1. Android Studio/WebView: login on slow network → spinner should always stop (or transition), never spin indefinitely.
2. Successful login with healthy network → navigate quickly to correct page based on profile.
3. Simulated slow profile fetch → user gets feedback and is moved to `/splash`, then resolves correctly.
4. Transient profile API error → should become `profileState='error'` (not `missing`), no false upload-documents redirect.
5. New/incomplete user → still routes to `/upload-documents` correctly.
6. Confirm logs no longer show long login dead-end without UI recovery.

Files to update in implementation phase:
- `src/pages/Login.tsx`
- `src/store/auth.ts`

Technical note:
No DB migration or Edge Function change is required for this fix; this is frontend state and flow hardening.
