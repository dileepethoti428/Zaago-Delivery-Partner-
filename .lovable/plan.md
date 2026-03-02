
## Plan: Add @capacitor/preferences as native Android storage for Supabase auth

### Why this is needed
The current `client.ts` uses `localStorage` as the auth storage adapter. On Android WebView (Capacitor), `localStorage` can be cleared by the OS when the app is backgrounded or killed, causing session loss on reopen. `@capacitor/preferences` writes to native Android SharedPreferences, which persists reliably across app restarts.

### Changes

**1. `package.json`** — Add `@capacitor/preferences` to dependencies (already have `@capacitor/core` and `@capacitor/push-notifications`, so Capacitor is set up).

**2. `src/integrations/supabase/client.ts`** — Replace with the provided implementation:
- Import `Preferences` from `@capacitor/preferences`
- Create `capacitorStorage` adapter (getItem/setItem/removeItem using `Preferences`)
- Pass it as `auth.storage` to `createClient`
- Remove the `customFetch` override (not needed since we're not modifying fetch behavior)
- Add `detectSessionInUrl: false` (correct for native apps — no URL-based OAuth)

### What stays the same
- `SUPABASE_URL` and `SUPABASE_KEY` env vars unchanged
- `persistSession: true` and `autoRefreshToken: true` preserved
- All auth store logic (`auth.ts`) unchanged — the storage adapter is transparent to it
- No changes to `AppProviders`, `Splash`, or any other file

### Note on `npx cap sync`
This is a CLI command the user runs locally after `npm install`. Lovable handles the `package.json` change; the user runs `npx cap sync` after pulling the code to their machine.
