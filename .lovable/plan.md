
## Remove `customFetch` from Supabase client

Single file change: `src/integrations/supabase/client.ts`

- Delete the `customFetch` function and all its JSDoc comments
- Remove the `global: { fetch: customFetch }` block from `createClient`
- Keep only the `capacitorStorage` adapter and auth config
