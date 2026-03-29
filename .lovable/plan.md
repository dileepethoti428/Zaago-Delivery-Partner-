

## Fix: "Not authenticated" from complete_delivery_zepto RPC

### Root cause
Line 56 creates a service_role client: `createClient(supabaseUrl, supabaseServiceKey)`. This client is used for everything — including the RPC call on line 328. But `complete_delivery_zepto` internally calls `auth.uid()`, which requires a user session context. The service_role client has no session, so `auth.uid()` returns NULL and the function returns "Not authenticated".

### Fix
In `supabase/functions/unified-complete-delivery/index.ts`, create a **second client** with the user's JWT (anon key + Authorization header) specifically for the RPC call. Keep the service_role client for direct table operations that bypass RLS.

**Changes (lines ~55-56 area):**
```ts
// Service client for direct DB ops (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Auth-context client for RPC calls that check auth.uid()
const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});
```

**Change (line ~328):** Switch the RPC call from `supabase.rpc(...)` to `supabaseWithAuth.rpc(...)`:
```ts
const { data, error } = await supabaseWithAuth.rpc(
  'complete_delivery_zepto',
  { p_order_id: order_id, p_agent_id: agent.id, p_payment_method: normalizedPayment }
);
```

### File
- `supabase/functions/unified-complete-delivery/index.ts` — 2 small edits

