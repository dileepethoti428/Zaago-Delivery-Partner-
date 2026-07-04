## Root cause

Both "call customer" (Delivery History) and "call support" (Help & Support) go through `src/utils/phone.ts` → `callPhone()`. In the Android Capacitor WebView, if `AppLauncher.openUrl({ url: 'tel:...' })` fails, the code falls back to `window.location.href = 'tel:...'`. The Android WebView cannot resolve `tel:` itself and shows `net::ERR_UNKNOWN_URL_SCHEME` — exactly the screen in your screenshot. Browsers don't hit this because they hand `tel:` to the OS.

Two contributing issues:
1. The `try/catch` swallows the AppLauncher error and then navigates the WebView to `tel:`, producing the error page.
2. Numbers stored without country code (e.g. `9182114939`) are fragile intent targets on Android dialers.

## Fix (frontend-only, one file)

Rewrite `src/utils/phone.ts`:
- Normalize the number: strip non-digits; if it's a bare 10-digit Indian number, prefix `+91`.
- On native (Capacitor): call `AppLauncher.openUrl`. If it throws, try `window.open(url, '_system')`. If that also fails, show a toast. **Never** fall back to `window.location.href` on native.
- On web: trigger via a temporary `<a href="tel:...">` click so the OS handles it.

No changes to `DeliveryHistoryCard.tsx`, `HelpSupport.tsx`, `ManageDelivery.tsx`, or any backend — they already call `callPhone()`, so fixing the utility fixes all sites.

## Verification

After merge, `git pull` → `npx cap sync` → rebuild the Android app, then tap the phone number in Delivery History and Help & Support. Expected: native dialer opens; no "Web page not available" screen.
