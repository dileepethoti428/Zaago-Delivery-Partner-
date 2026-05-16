## Problem
On the Capacitor Android app, tapping the customer phone number in Delivery History opens an in-webview navigation to `tel:7842343642`, which the WebView cannot handle and shows `net::ERR_UNKNOWN_URL_SCHEME`. On web browsers `tel:` is handled natively, so it works there.

The same issue exists in other places that use raw `tel:` anchors / `window.location.href = 'tel:...'`.

## Fix
Use Capacitor's `@capacitor/app-launcher` to open `tel:` URLs on native, and fall back to standard `tel:` href on web. Install the plugin and add a tiny helper, then use it everywhere a phone link exists.

### Steps
1. Install `@capacitor/app-launcher`.
2. Create `src/utils/phone.ts` with a `callPhone(phone)` helper:
   - Native (Capacitor.isNativePlatform()): `AppLauncher.openUrl({ url: 'tel:<digits>' })`
   - Web: `window.location.href = 'tel:<digits>'`
   - Strip spaces / non-dial chars before dialing.
3. Update the three places to call this helper instead of relying on the `tel:` href:
   - `src/components/delivery/DeliveryHistoryCard.tsx` — change the `<a href="tel:...">` to a `<button>` (or keep `<a>` but `preventDefault` and call helper) that calls `callPhone(delivery.customer_phone)`; keep `stopPropagation`.
   - `src/pages/ManageDelivery.tsx` (line 82) — replace `window.location.href = tel:...` with `callPhone(phone)`.
   - `src/pages/HelpSupport.tsx` (line 247) — wire the support phone anchor through `callPhone`.
4. After install, remind the user to run `npx cap sync` so the native plugin is registered on Android/iOS.

### Why AppLauncher (not Browser.open)
`@capacitor/browser` opens an in-app Chrome Custom Tab, which also cannot handle `tel:`. `AppLauncher.openUrl` hands the URL to the OS, which routes `tel:` to the dialer.

No backend or business-logic changes.