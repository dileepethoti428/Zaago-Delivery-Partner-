
## Root Cause Identified

The logs prove two things:

1. Razorpay does NOT return `qr_string` (not included in the response fields list)
2. Razorpay DOES return `image_url` (confirmed in response fields list)

The fallback currently builds a manual UPI string: `upi://pay?pa=zaago431980.rzp@rxairtel&...`

The VPA `zaago431980.rzp@rxairtel` is a Razorpay-generated virtual address — UPI apps often fail on these with "provider facing technical issue" because this address type has specific routing requirements that may not be active on the account.

**The fix:** Use `image_url` from Razorpay's response — it IS returned and contains a properly generated, scannable QR image that Razorpay hosts. This will always work because it's the official QR rendered by Razorpay, not a manually constructed UPI string.

### Changes needed

**1. `supabase/functions/generate-payment-qr/index.ts`**

Return `image_url` from Razorpay's response to the frontend:
```typescript
return new Response(
  JSON.stringify({
    success: true,
    qr_code_id: qrData.id,
    qr_string: upiString,           // keep as fallback
    qr_code_url: qrData.image_url,  // ← ADD THIS — the real hosted QR image
    amount: amount,
    expires_at: qrData.close_by,
  }),
  ...
);
```

**2. `src/components/delivery/RazorpayQRDisplay.tsx`**

Priority order for QR display:
- First try `image_url` (Razorpay-hosted QR) — most reliable, always works
- Fall back to `qr_string` (manual UPI) only if `image_url` is absent
- Fix TypeScript build error: `NodeJS.Timeout` → `ReturnType<typeof setInterval>`

**3. `src/pages/ManageDelivery.tsx`**

The `generateAndShowQR` function already maps `data.qr_code_url` into `qrData.image_url`, so no change needed there — it's already correct.

### Also fix the build error

Line 25 in `RazorpayQRDisplay.tsx`:
```typescript
// Before (broken)
const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

// After (fixed)
const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
```

### Files to change
1. `supabase/functions/generate-payment-qr/index.ts` — ensure `image_url` is in response (it already maps to `qr_code_url` but confirm)
2. `src/components/delivery/RazorpayQRDisplay.tsx` — prioritize `image_url` over manual UPI string + fix TS error
