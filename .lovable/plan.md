
## Root Cause

The `generate-payment-qr` edge function was updated in code but **was not redeployed**. The logs confirm the old version is running — the new log line `🔍 Razorpay QR response fields:` never appears, meaning the fallback UPI string construction code is not live.

The old deployed version returns the raw Razorpay response, which does **not** contain `qr_string` (Razorpay returns `image_url` instead). So `data.qr_string` is `undefined` → `qrData.qr_string` is `undefined` → component shows "QR code unavailable".

Additionally, `RAZORPAY_VPA` secret is missing, which would break the fallback even after deploy.

## Fix

### 1. Add `RAZORPAY_VPA` secret
Need to add the Razorpay VPA (Virtual Payment Address / UPI ID) as a secret so the fallback UPI string is valid. This is the UPI ID that receives payments (e.g. `yourmerchant@razorpay` or `business@upi`).

### 2. Redeploy `generate-payment-qr`
Force redeploy the edge function so the new code (with `upiString` fallback) goes live.

### 3. Fix the component fallback — add `qr_code_url` as secondary display option
As an extra safety net: if `qr_string` is still missing after deploy, instead of showing "QR unavailable", show the Razorpay-hosted image as a last resort `<img>` fallback.

## Changes

**`supabase/functions/generate-payment-qr/index.ts`**:
- Add a log line to confirm which path is taken (qr_string from Razorpay vs manually constructed)
- Ensure the function is redeployed by making a minor change (the log addition serves this purpose)
- The `RAZORPAY_VPA` will be read from secrets

**`src/components/delivery/RazorpayQRDisplay.tsx`**:
- Add a fallback: if `qrData.qr_string` is falsy but `qrData.image_url` is present, show `<img src={image_url}>` instead of the error state
- This ensures payment always works regardless of Razorpay plan limitations

The user will need to provide their Razorpay VPA (UPI ID) so we can add it as a secret. This is the UPI address linked to their Razorpay account — typically found in Razorpay Dashboard → Settings → Bank Account.
