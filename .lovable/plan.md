
## The Issue

The user is correct. `window.open(url, '_system')` is a Capacitor/Cordova-specific target that only works when the app is running inside a native WebView with the InAppBrowser plugin. In a standard web browser (PWA or regular web), it either does nothing or fails silently.

The fix is simple: replace `window.open(url, '_system')` with `window.location.href = url` which works universally — web, PWA, and Capacitor native builds.

Looking at the codebase:
- `src/pages/ManageDelivery.tsx` already uses `window.location.href = \`tel:${phone}\`` (the correct pattern)
- `src/pages/HelpSupport.tsx` uses `<a href="tel:...">` (also correct)
- **Only 2 files need fixing**: `Profile.tsx` and `Deactivated.tsx`

## Changes

**`src/pages/Profile.tsx`** (line 278):
```tsx
// Before
onClick={() => window.open('tel:+917842343642', '_system')}
// After
onClick={() => { window.location.href = 'tel:+917842343642'; }}
```

**`src/pages/Deactivated.tsx`** (lines 49, 56):
```tsx
// Before
onClick={() => window.open('tel:+917842343642', '_system')}
onClick={() => window.open('mailto:helpzaago@gmail.com', '_system')}
// After
onClick={() => { window.location.href = 'tel:+917842343642'; }}
onClick={() => { window.location.href = 'mailto:helpzaago@gmail.com'; }}
```

That's 3 one-line changes across 2 files. No new dependencies needed.
