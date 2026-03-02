
## Single line change in `src/store/auth.ts` (line 152)

The timeout branch on line 150–153 unconditionally wipes the session when `getSession` times out and `INITIAL_SESSION` hasn't fired yet. But as seen in the logs, SIGNED_IN can arrive shortly after the timeout — so clearing the session creates a logout→login loop.

**Change**: Replace line 152 only.

```typescript
// BEFORE (line 152)
set({ session: null, user: null, profile: null, loading: false });

// AFTER
console.warn('[Auth] getSession timed out — continuing with existing session');
set({ loading: false });
```

This keeps any session that may already be in flight via the `onAuthStateChange` listener, and simply unblocks the loading state so the app doesn't hang. If there truly is no session, the listener will have already set `session: null` via the `SIGNED_OUT` or empty `INITIAL_SESSION` event — so nothing is lost.

Only file changed: `src/store/auth.ts`, line 152.
