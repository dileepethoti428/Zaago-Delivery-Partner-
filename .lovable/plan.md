
## Problem

On mobile (Capacitor app), `https://wa.me/917842343642` opens in the in-app browser which shows "web page not available" because the device hasn't loaded the WhatsApp web page correctly in-app, or the deep link isn't being used. On web it should use `https://wa.me/917842343642`. On native app it should use the `whatsapp://send?phone=917842343642` deep link.

The fix: replace the `<a href>` with a button that uses `window.open` with the correct URL. To make it work on both web and native, use the `whatsapp://send?phone=917842343642` URI which native apps handle natively, and fall back to `https://wa.me/917842343642` for web browsers.

Actually, a simpler and reliable cross-platform approach: use `https://api.whatsapp.com/send?phone=917842343642` which is a universal link that works on both web and app. Even better: use `window.open('https://wa.me/917842343642', '_system')` for Capacitor (opens in system browser, not in-app WebView) vs `_blank` for web.

The cleanest fix that works on both web and native Capacitor:
- Use `window.open(url, '_system')` — in Capacitor, `_system` opens the URL in the device's default browser/WhatsApp app rather than the in-app WebView, which lets WhatsApp deep link resolve properly.
- On web, `_system` behaves like `_blank`.

### Changes

**`src/pages/Deactivated.tsx`**:
- Change the `<a>` tag to a `<button>` that calls `window.open('https://wa.me/917842343642', '_system')`

**`src/pages/Profile.tsx`**:
- Change `handleWhatsAppClick` from `window.open(..., '_blank')` to `window.open(..., '_system')`

That's it — two small one-line changes.
