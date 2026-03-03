
## Changes

Replace the floating Call Support button on `Profile.tsx` with a WhatsApp button, and replace the "Call Support" button on `Deactivated.tsx` with WhatsApp. Use `@capacitor/browser` `Browser.open()` which works universally across Web, APK, PWA, and Android WebView.

**`src/pages/Profile.tsx`**:
- Import `Browser` from `@capacitor/browser`
- Change the floating button icon from `Phone` to `MessageCircle` (WhatsApp icon from lucide)
- Change `onClick` to call `Browser.open({ url: 'https://wa.me/917842343642' })`
- Update `aria-label` to "WhatsApp Support"
- Remove `Phone` from lucide imports, add `MessageCircle`

**`src/pages/Deactivated.tsx`**:
- Import `Browser` from `@capacitor/browser`
- Change the "Call Support" button to "WhatsApp Us"
- Replace `Phone` icon with `MessageCircle`
- Change `onClick` to `Browser.open({ url: 'https://wa.me/917842343642' })`
- Keep "Email Us" button as-is but also update it to use `Browser.open({ url: 'mailto:helpzaago@gmail.com' })` for consistency
- Remove `Phone` from lucide imports, add `MessageCircle`

`@capacitor/browser` is not yet installed — need to add it as a dependency. It's a standard Capacitor plugin that works on web too (falls back to `window.open`).

Wait — let me check if it's already installed.

Looking at package.json dependencies: `@capacitor/app`, `@capacitor/core`, `@capacitor/preferences`, `@capacitor/push-notifications` — no `@capacitor/browser`. Need to install it.

## Plan

1. Install `@capacitor/browser` package
2. Update `Profile.tsx` floating button → WhatsApp via `Browser.open`
3. Update `Deactivated.tsx` Call Support button → WhatsApp via `Browser.open`
