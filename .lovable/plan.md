
## Problem: QR is shrinking/distorted on mobile

### Root Cause

In `RazorpayQRDisplay.tsx`, the QR image (and SVG fallback) are hardcoded at `width: 300, height: 300` in pixels. On mobile, the `DialogContent` is narrower than `300px + dialog padding (≈32px)`, so the browser squishes the image to fit — making the QR unreadable and uncapturable by UPI apps.

Additionally, `imageRendering: 'pixelated'` is applied to the Razorpay-hosted PNG/JPEG, which makes it blurry when scaled down (this style is for pixel art, not photos/QR images).

### The Fix

**Make the QR responsive** — use CSS `width: 100%` + `aspect-ratio: 1` instead of fixed pixel dimensions, with a `max-width` cap for tablets/desktop.

Three specific changes in `src/components/delivery/RazorpayQRDisplay.tsx`:

**1. Normal dialog QR (line 192–201) — replace fixed pixel size with responsive CSS:**
```tsx
// Before
<img style={{ width: QR_SIZE, height: QR_SIZE, imageRendering: 'pixelated' }} />

// After
<img style={{ width: '100%', height: 'auto', display: 'block' }} />
// Container div gets: className="w-full max-w-[280px] mx-auto"
```

**2. SVG fallback QR (line 208–216) — use viewport-relative size:**
```tsx
// Before
<QRCodeSVG size={QR_SIZE} />

// After — compute size from window.innerWidth at render time
const dialogQrSize = Math.min(280, Math.floor((window.innerWidth - 64) * 0.9));
<QRCodeSVG size={dialogQrSize} />
```

**3. Remove `imageRendering: 'pixelated'`** from both normal and fullscreen `<img>` — Razorpay serves a high-res PNG, pixelated rendering hurts quality

**4. Dialog outer container** — add `w-full` constraint so the QR wrapper fills properly:
The outer `<div className="flex justify-center">` wrapping the QR box should let the image fill properly.

### Files to change
1. **`src/components/delivery/RazorpayQRDisplay.tsx`** — make QR responsive (normal + fullscreen), remove pixelated rendering

No backend changes needed.
