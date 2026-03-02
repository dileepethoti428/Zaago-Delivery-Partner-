
## Change to `src/integrations/supabase/client.ts`

The current client has no `global.fetch` override. We add a QUIC-safe custom fetch that:
- Sets `cache: "no-store"` — prevents WebView from using a cached QUIC connection
- Adds `"x-client-info": "capacitor-app"` header — signals non-browser context, nudges Supabase CDN to prefer HTTP/2 over HTTP/3

Then pass it as `global: { fetch: customFetch }` to `createClient`.

### Only file changed: `src/integrations/supabase/client.ts`

No other JS/TS files need changes. The Android native XML files (`network_security_config.xml`, `AndroidManifest.xml`) are outside the Vite project and must be edited locally after git pull — instructions provided to the user after the code change.
