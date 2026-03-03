
## Understanding the Current State

The `generate-payment-qr` edge function already calls Razorpay's API and returns:
- `qr_code_id` — the Razorpay QR ID
- `qr_code_url` — Razorpay-hosted image URL (the "static uploaded QR image" the user is seeing)
- `qr_string` — the raw UPI string (e.g. `upi://pay?...`)

In `RazorpayQRDisplay`, the rendering logic already **prefers `qr_string`** first (renders it via `QRCodeSVG`), only falling back to `image_url` if no `qr_string`. The problem is that `qr_string` may not always be returned by Razorpay's API (it's not guaranteed on all plans), causing the fallback `<img>` to render the Razorpay-hosted image — which is what the user is seeing as "static uploaded QR image."

## The Fix

Instead of relying on Razorpay's `qr_string` or `image_url`, we should:

1. **Always generate the QR from the UPI payment string ourselves** using `qrcode.react` (already installed).
2. Construct a standard UPI deep link from the Razorpay QR data or from our own UPI VPA (Virtual Payment Address).

The Razorpay `qr_string` is a standard UPI string like `upi://pay?pa=merchant@upi&pn=Name&am=100&cu=INR&tn=desc`. We can use this directly with `QRCodeSVG`.

**If `qr_string` is not returned by Razorpay**, the edge function should construct one manually from the Razorpay QR response fields. Razorpay QR codes include enough data to reconstruct the UPI string.

### Changes

**`supabase/functions/generate-payment-qr/index.ts`**:
- After creating the QR via Razorpay, extract `qr_string` from the response
- If `qr_string` is missing, construct a UPI string manually: `upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn=Order_{id}`
- Return the `qr_string` always (guaranteed non-null)

**`src/components/delivery/RazorpayQRDisplay.tsx`**:
- Remove the `<img>` fallback path entirely — always render `QRCodeSVG` using `qr_string`
- Show a proper error if `qr_string` is missing instead of showing a broken image
- Add the amount display (₹X) and timer countdown text on screen so the customer knows what they're paying

**`src/assets/razorpay-qr-reference.jpeg`**: No longer needed (static reference image — not used in code, just an asset).

### Summary

The core issue: Razorpay's `image_url` is fetched from their servers (external image = "static uploaded QR"). The fix is to ensure `qr_string` is always available and always render it ourselves with `QRCodeSVG` — fully dynamic, no external image dependency, works offline once loaded, renders crisply at any size.
