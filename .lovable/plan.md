
## Problem Analysis

The current code uses `window.open('https://wa.me/917842343642', '_system')`.

On Capacitor (native Android/iOS), `window.open` with `_system` is supposed to open in the system browser, but **this is unreliable** on many Capacitor setups. The correct Capacitor-native way to open external URLs is using the **`@capacitor/app` plugin's `App.openUrl()`** or better yet the **`Capacitor.getPlatform()`** check combined with a native intent.

The most reliable cross-platform approach for Capacitor is to use `window.location.href = 'whatsapp://send?phone=917842343642'` on native (which triggers Android/iOS native WhatsApp intent directly) and fall back to `https://wa.me/917842343642` on web.

Even simpler and most reliable: use the `whatsapp://send?phone=917842343642` scheme directly. On native Android/iOS, this opens WhatsApp app directly. If WhatsApp isn't installed it fails gracefully. On web, fall back to `https://wa.me/917842343642`.

Since the project already has `@capacitor/core` installed, we can use `Capacitor.getPlatform()` to detect native vs web.

### Fix

Create a helper function `openWhatsApp()`:

```ts
import { Capacitor } from '@capacitor/core';

export function openWhatsApp(phone: string = '917842343642') {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    // Use native deep link scheme - opens WhatsApp directly on Android/iOS
    window.location.href = `whatsapp://send?phone=${phone}`;
  } else {
    // Web: open in new tab
    window.open(`https://wa.me/${phone}`, '_blank');
  }
}
```

On Android/iOS `window.location.href = 'whatsapp://...'` triggers the native intent system and opens WhatsApp directly — this is the most reliable method and what many production Capacitor apps use.

### Files to change

1. **`src/utils/maps.ts`** — No, create a new small utility or just inline it in both pages.

Actually, keep it simple: just update the two files directly.

- **`src/pages/Profile.tsx`** — update `handleWhatsAppClick`
- **`src/pages/Deactivated.tsx`** — update the onClick

No new utility file needed, just two lines changed.

### Implementation

```ts
// In Profile.tsx and Deactivated.tsx
import { Capacitor } from '@capacitor/core';

const openWhatsApp = () => {
  if (Capacitor.isNativePlatform()) {
    window.location.href = 'whatsapp://send?phone=917842343642';
  } else {
    window.open('https://wa.me/917842343642', '_blank');
  }
};
```

This is the correct and proven approach for Capacitor apps to open WhatsApp.
