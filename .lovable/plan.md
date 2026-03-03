
## Understanding the Problem

The component uses **two rendering paths**:

1. **`upiString` present** → `QRCodeSVG` renders an inline SVG — this is already perfect, SVG has infinite resolution, no pixel distortion possible here.
2. **`upiString` absent, `image_url` present** → `<img>` rendered at `style={{ width: qrSize, height: qrSize }}` where `qrSize` is a JS-computed pixel value (240–320px). This is the problematic path — the image from Razorpay is being scaled down to 240–320px, causing pixel smoothing and QR distortion when screenshotted.

The `image_url` from Razorpay is typically ~512px or similar. Forcing it into 240–320px via CSS causes browser anti-aliasing/smoothing.

Additionally, the `DialogContent` in `dialog.tsx` uses Radix UI animations: `data-[state=open]:zoom-in-95` — this applies a CSS `scale` transform during the open animation. While this is transient (animation only), it can still cause rendering artifacts on screenshots taken during or just after open.

## Fix Plan

### 1. Fix `<img>` fallback rendering (the main issue)
- Use `image-rendering: pixelated` and `image-rendering: crisp-edges` on the `<img>` element
- Fix size to **360px × 360px** with no percentage scaling
- Remove the dynamic `qrSize` computation for the `<img>` path — use fixed 360px

### 2. Fix `QRCodeSVG` size 
- The SVG path also uses `qrSize` (240–320px based on `window.innerWidth * 0.72`). This is fine for SVG (SVG scales perfectly) but for consistency and scan reliability, set a fixed size of **300px** for the modal view — enough to fill the dialog without overflow and render all QR modules at proper density.

### 3. Remove dynamic qrSize resize listener
- Replace the dynamic `qrSize` state (currently 240–320px) with a fixed constant of `300` for the modal. No JS resize listener needed.

### 4. Ensure no scaling on the wrapper `div`
- The wrapper `div` around QR only has `bg-white rounded-xl border p-3` — no transform or filter. This is fine.
- The `DialogContent` has Radix animation (`zoom-in-95`) but this is only during the open transition (200ms) — it resolves to `scale(1)` once open, so no permanent distortion.

### Changes

**`src/components/delivery/RazorpayQRDisplay.tsx`**:
- Remove `qrSize` state and the `useEffect` that computes it (replace with fixed constant `300`)
- On the `<img>` fallback: fix size to `360px × 360px`, add `image-rendering: pixelated` and `imageRendering: 'pixelated'` inline style, remove `width: qrSize, height: qrSize`
- On `QRCodeSVG` in modal: use fixed size `300`
- Keep fullscreen `fsQrSize` dynamic (that's fine — fullscreen is for visual preview, not screenshot scanning)
- Add `imageRendering: 'pixelated'` to the fullscreen `<img>` path too if applicable

These are minimal, targeted changes. No dialog.tsx changes needed since the zoom animation is transient.
