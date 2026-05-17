### Goal
Change the floating WhatsApp support button on the Profile page from the current `bg-primary` (blue) to the original WhatsApp brand green.

### Change
In `src/pages/Profile.tsx`, update the fixed floating button:
- Change background from `bg-primary` to WhatsApp green (`bg-[#25D366]`)
- Keep the white icon (`text-white` or keep `text-primary-foreground` if it remains white)

### Why
The user explicitly requested the "original colour of what's up which is green" for brand accuracy.

### Verification
Visually confirm the button renders green with a white icon in the preview.