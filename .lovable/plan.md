

## Fix Service Worker Supabase Bypass

**File:** `public/sw.js`

**Problem:** Line 69 uses `event.respondWith(fetch(request))` for Supabase requests. This forces the service worker to handle the request — if the fetch promise rejects for any reason (timeout, CORS, network blip), the SW converts it into a `FetchEvent resulted in a network error response`, killing auth requests. The same issue exists on line 75 for edge function routes.

**Fix:** Replace `event.respondWith(fetch(request))` with a plain `return` on both Supabase and edge function bypass paths. This tells the service worker "I'm not handling this request" and lets the browser's native fetch handle it directly — no SW involvement at all.

### Changes (lines 67-76)

```text
BEFORE:
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/rest/v1/')) {
    event.respondWith(fetch(request));
    return;
  }

AFTER:
  if (url.hostname.includes('supabase.co')) {
    return; // Let browser handle natively
  }

  if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/rest/v1/')) {
    return; // Let browser handle natively
  }
```

After this change, users must unregister the old service worker (DevTools > Application > Service Workers > Unregister, then refresh) or the cached SW will still run the old code.
