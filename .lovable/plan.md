
## Problem & Solution

The WhatsApp deep link has been unreliable across attempts. Instead of fighting with WhatsApp URL schemes, we'll take a completely different approach:

**Drop the WhatsApp redirect entirely.** Replace it with two reliable, always-working contact methods:

1. **Phone call** — `tel:+917842343642` — works on every device natively, no app needed
2. **Email** — `mailto:helpzaago@gmail.com` — universal fallback

This is more reliable than any WhatsApp deep link and already works perfectly (HelpSupport.tsx uses `tel:` and `mailto:` links that work fine).

---

## Changes

### `src/pages/Profile.tsx`
- Remove the floating WhatsApp button entirely
- Add a "Contact Support" button in the Quick Actions card that navigates to `/help` (Help & Support page already has phone + email contact)

### `src/pages/Deactivated.tsx`
- Replace the broken WhatsApp button with two side-by-side buttons:
  - **Call Support** → `tel:+917842343642` (green, Phone icon)
  - **Email Support** → `mailto:helpzaago@gmail.com` (blue, Mail icon)

### `src/pages/HelpSupport.tsx`
- Add a prominent **WhatsApp card** at the top of the Contact tab using `tel:` link as primary CTA, keeping the form as secondary

This removes all dependency on WhatsApp deep link behavior while giving users multiple reliable ways to reach support.
