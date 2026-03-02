
I understand how frustrating this has been. I reviewed your auth flow, splash flow, router, and the latest logs.

Do I know what the issue is? Yes.

Root cause summary (from current code):
1) `main.tsx` mounts correctly and router is initialized correctly.  
2) The real “blank after splash” lock is in guard logic:
   - `RequireApproval.tsx` starts an 8s bypass timer on every `profileState` change.
   - `fetchProfile()` retries flip `profileState` between `loading` and `error` every few seconds.
   - That keeps resetting the timer, so bypass may never trigger, leaving the app on skeleton/blank forever.
3) `Splash.tsx` currently has competing timers and can route to protected pages on partial/stale session state (`/my-deliveries`) instead of reliably sending unauthenticated users to `/login`.
4) No wildcard route (`*`) + no global error boundary means unmatched routes/runtime crashes can appear as a white screen.
5) Startup is slower than needed because auth/profile boot path still waits on network races before route settles.

Implementation plan (step-by-step fix)

1. Stabilize app boot + add crash visibility
Files:
- `src/App.tsx`
- `src/main.tsx`
- `src/components/system/AppErrorBoundary.tsx` (new)
- `src/utils/startupDiagnostics.ts` (new)

Changes:
- Replace `App.tsx` (currently `return null`) with actual root composition:
  - `<AppErrorBoundary>`
    - `<AppProviders>`
      - `<NetworkStatusWrapper>`
        - `<RouterProvider router={router} />`
- Update `main.tsx` to render `<App />` only.
- Add startup diagnostics once on app boot:
  - `window.onerror`
  - `window.onunhandledrejection`
  - console markers for boot phase transitions.
- Add a user-safe fallback UI in error boundary (“Something went wrong”, Retry, Go to Login).

Why:
- Prevent silent white screens.
- Makes runtime failures visible and recoverable.

2. Fix routing safety (404/catch-all)
File:
- `src/router/index.tsx`

Changes:
- Add final fallback route:
  - `path: '*'`
  - `element: <Navigate to="/login" replace />`
- Keep `/`, `/splash`, `/login` explicit and unchanged in intent.

Why:
- Any unmatched path will never render blank again.

3. Fix auth guard deadlock (main blank-screen bug)
Files:
- `src/components/auth/RequireApproval.tsx`
- `src/components/auth/RequireAuth.tsx`

Changes:
- In `RequireApproval.tsx`, change bypass timer to depend on unresolved boolean, not raw `profileState` transitions.
  - Use `isUnresolved = ['idle','loading','error'].includes(profileState)`.
  - Start 1 timer when unresolved begins; do not reset while unresolved stays true.
  - After timeout, stop blocking and render recovery path.
- In `RequireAuth.tsx`, add boot deadline behavior:
  - If auth still loading past deadline and no valid session => redirect `/login`.
  - Keep retry controls but never allow infinite skeleton.
- Add token staleness safety check (`session.expires_at`) before granting protected outlet.

Why:
- Eliminates the loading/error timer-reset loop that causes endless blank/skeleton.

4. Make splash deterministic and faster
File:
- `src/pages/Splash.tsx`

Changes:
- Replace current multi-timer behavior with one deterministic boot deadline flow:
  - If `loading` resolves quickly: route immediately based on session/profile.
  - If deadline hits:
    - no session => `/login`
    - session exists => protected landing (`/my-deliveries`) with guards handling profile.
- Remove redundant/competing timers that can conflict with auth transitions.
- Ensure no repeated navigation loops.

Why:
- Splash always exits predictably.
- Unauthenticated users reliably reach Login.

5. Reduce auth initialization blocking time
File:
- `src/store/auth.ts`

Changes:
- Keep listener-first pattern.
- Decouple “auth loading” from slow profile calls:
  - mark `loading=false` once session state is known.
  - continue profile fetch/retry in background via `profileState`.
- Keep existing retry backoff; avoid long blocking path at boot.
- Preserve current error classification (`PGRST116` vs transient errors).

Why:
- Faster perceived launch.
- Prevents splash waiting on slow profile/API calls.

6. Capacitor splash handling (native-safe)
Files:
- `package.json` (if missing plugin)
- `src/pages/Splash.tsx` or a bootstrap helper

Changes:
- Add guarded native splash hide:
  - `if (Capacitor.isNativePlatform()) SplashScreen.hide().catch(...)`
- Call hide only after app readiness decision (not before router/auth state is settled).
- Never block UI waiting for hide.

Why:
- Prevents native splash freeze on Android/iOS.
- Keeps web behavior unaffected.

7. Safe render guard to force login when session/auth fails
Files:
- `src/components/auth/RequireAuth.tsx`
- `src/pages/Splash.tsx`

Changes:
- If session is missing/expired or auth check fails beyond deadline, always navigate to `/login`.
- No protected route rendering without a valid usable session.

Why:
- Matches your expected behavior: after splash, login must appear when auth isn’t valid.

8. Performance tuning (quick wins for slow startup)
Files:
- `src/store/auth.ts`
- `src/router/index.tsx` (optional phase-2 lazy loading)

Changes:
- Remove unnecessary blocking `await`s before first route paint.
- Optional: lazy-load heavy protected pages (`Home`, `Earnings`, `MyDeliveries`) with fallback skeleton.

Why:
- Faster time-to-interactive on mobile/webview.

Exact files to modify
- `src/App.tsx`
- `src/main.tsx`
- `src/router/index.tsx`
- `src/pages/Splash.tsx`
- `src/components/auth/RequireAuth.tsx`
- `src/components/auth/RequireApproval.tsx`
- `src/store/auth.ts`
- `src/components/system/AppErrorBoundary.tsx` (new)
- `src/utils/startupDiagnostics.ts` (new)
- `package.json` (only if adding `@capacitor/splash-screen`)

Validation checklist after implementation
1) Cold start with no session => Splash briefly shows, then `/login` always appears.  
2) Signed-in user on slow network => no white/blank lock; app exits splash deterministically.  
3) Force profile API errors => guard never gets stuck forever; recovery path is shown.  
4) Unknown route (e.g. `/abc`) => redirects to `/login` (no blank page).  
5) Simulate runtime throw => ErrorBoundary fallback appears (not white screen).  
6) Measure startup timing before/after to confirm speed improvement.

Technical note
- `App.tsx` is currently unused (`return null`), which is risky for maintainability and debugging. I will make it the true app root so startup instrumentation and error boundary are guaranteed in one place.
