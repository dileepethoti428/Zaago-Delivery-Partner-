
## Root Cause

Android WebView (Capacitor) throws "unknown url scheme" for `<a href="tel:">` and `<a href="mailto:">` anchor tags because the WebView tries to navigate to those URLs directly instead of delegating to Android's intent system.

The fix: replace all `<a href="tel:...">` and `<a href="mailto:...">` with `<button>` elements that call `window.open(url, '_system')`. In Capacitor, `_system` specifically tells the native layer to handle the URL via the OS intent system — this is the correct and documented Capacitor way to open phone/email/external links.

This is different from the previous WhatsApp attempt because `tel:` and `mailto:` are standard Android intents that `_system` handles perfectly. WhatsApp's `https://wa.me` failed because it's an HTTPS URL, not a native intent URI.

## Changes

**`src/pages/Deactivated.tsx`**:
- Replace `<a href="tel:+917842343642">` with a `<button>` calling `window.open('tel:+917842343642', '_system')`
- Replace `<a href="mailto:helpzaago@gmail.com">` with a `<button>` calling `window.open('mailto:helpzaago@gmail.com', '_system')`

**`src/pages/Profile.tsx`**:
- Replace the floating `<a href="tel:+917842343642">` with a `<button>` calling `window.open('tel:+917842343642', '_system')`

No imports needed — `window.open` is native browser API available everywhere.
