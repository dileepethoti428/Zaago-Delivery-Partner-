
## Two Bugs Found

### Bug 1: Screen turns off → QR dialog disappears

**Root cause**: When the screen turns off and back on, `document.visibilityState` fires `visible` → `onAppResume()` → `resetAllLoaders()` runs. But more critically, the `useResumeGuard` in `ManageDelivery.tsx` (if used) or a parent navigation reset could close dialogs. However, looking carefully: the actual cause is that **Radix UI Dialog checks focus** — when the screen turns off, the browser window loses focus. Some Radix versions auto-dismiss modals on focus loss. But the real smoking gun is `onOpenChange={(open) => !open && handleClose()}` — if Radix fires `onOpenChange(false)` on visibility loss, it calls `handleClose()` which clears the interval and calls `onClose()` which sets `showQRDialog = false` in ManageDelivery, permanently killing the QR dialog.

**Fix**: Add `modal={false}` on the QR dialog to prevent Radix from auto-closing it on focus changes, OR replace the outer Dialog with a persistent overlay that doesn't auto-close on visibility change. Best approach: use `preventAutoFocus` and add a `NoCloseonBlur` approach by keeping dialog state in a ref and using `wakeLock` API to prevent screen timeout.

Actually simpler fix: add the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) when the QR dialog opens so the screen **never turns off** while waiting for payment. This is the perfect UX solution — the screen should stay on while a customer is scanning the QR. Release the lock when dialog closes.

### Bug 2: Fullscreen tap shows blank screen

**Root cause**: Line 225 in `RazorpayQRDisplay.tsx` — the fullscreen Dialog only renders if `upiString` is truthy:
```tsx
{upiString && (
  <div className="bg-white p-4 rounded-xl">
    <QRCodeSVG ... />
  </div>
)}
```
If the `image_url` fallback path is used (no `upiString`), the fullscreen dialog body is **completely empty** — just shows the amount and "Tap outside to close" text. The `<img>` fallback is NOT inside the fullscreen dialog at all.

**Fix**: Add the same `<img>` fallback inside the fullscreen dialog body (parallel to the `upiString` check).

---

## Changes

**`src/components/delivery/RazorpayQRDisplay.tsx`**:

1. **Screen Wake Lock** — acquire `navigator.wakeLock.request('screen')` when `open` becomes true, release on dialog close/unmount. This prevents screen-off from dismissing the QR dialog.

2. **Fullscreen blank fix** — Add `image_url` branch inside the fullscreen Dialog:
```tsx
{upiString ? (
  <div className="bg-white p-4 rounded-xl">
    <QRCodeSVG value={upiString} size={fsQrSize} ... />
  </div>
) : qrData?.image_url ? (
  <div className="bg-white p-4 rounded-xl">
    <img src={qrData.image_url} style={{ width: fsQrSize, height: fsQrSize, imageRendering: 'pixelated' }} />
  </div>
) : null}
```

3. **Also guard Radix Dialog dismissal** — add `onInteractOutside={(e) => e.preventDefault()}` on the main QR dialog so tapping outside doesn't close it accidentally (user should use the X button only, since payment may be in progress).

These are all changes in a single file.
