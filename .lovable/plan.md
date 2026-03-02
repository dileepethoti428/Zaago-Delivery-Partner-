

# Fix: "Delivered" Button Not Completing (CORS Preflight Failure)

## Root Cause

The `unified-complete-delivery` edge function has **zero logs** during the time the user clicks "Delivered". This means the HTTP request never reaches the server. The cause is a **CORS preflight rejection**: the Supabase JS SDK sends headers that aren't in the function's `Access-Control-Allow-Headers` list, so the browser blocks the actual POST request after the OPTIONS preflight fails.

Current (broken):
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

Required:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

The same issue likely affects `generate-payment-qr` and `cancel-delivery` since they're called from the same page.

## Fix Plan

### 1. Update CORS headers in `unified-complete-delivery`

**File**: `supabase/functions/unified-complete-delivery/index.ts`
- Update `corsHeaders` to include the full set of Supabase client headers
- Migrate from deprecated `serve()` import to `Deno.serve()` pattern for consistency

### 2. Update CORS headers in `generate-payment-qr`

**File**: `supabase/functions/generate-payment-qr/index.ts`
- Same CORS header fix

### 3. Update CORS headers in `cancel-delivery`

**File**: `supabase/functions/cancel-delivery/index.ts`
- Same CORS header fix

### 4. Update CORS headers in `complete-delivery-v2`

**File**: `supabase/functions/complete-delivery-v2/index.ts`
- Same CORS header fix (this function also has outdated headers)

## Why This Is the Fix

- The Supabase JS SDK (v2.56.0 in this project) sends platform-identifying headers with every request
- The browser sends an OPTIONS preflight request first to check if these headers are allowed
- The edge function rejects the preflight because those headers aren't listed
- The browser never sends the actual POST request
- The `Promise.race` 15-second timeout eventually fires, but the user perceives it as "not responding"
- After refreshing the app, the browser may retry with a fresh CORS cache, which is why it sometimes works briefly

## Expected Result

After updating the CORS headers and redeploying:
- "Delivered" button will call the edge function successfully
- Response will return in 1-3 seconds instead of timing out at 15 seconds
- No more silent failures

