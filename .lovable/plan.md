
## Analysis

**Current state:**
- `ensureAgentExists()` and `syncLocationAfterAuth()` are defined locally in `Login.tsx` (not exported)
- `registerFCMToken()` is imported from `@/utils/fcm`
- These three are called in `handleLogin` and `handleSignup` only — NOT on session restore
- `src/store/auth.ts` has no knowledge of these side effects

**Plan: 3 surgical changes**

### Step 1 — Create `src/utils/postAuthInit.ts`
Extract `ensureAgentExists()` and `syncLocationAfterAuth()` from `Login.tsx` into a new shared utility file. This avoids circular imports (store importing from a page).

```ts
// src/utils/postAuthInit.ts
export async function ensureAgentExists(): Promise<void> { ... }
export async function syncLocationAfterAuth(): Promise<void> { ... }
```

### Step 2 — `src/store/auth.ts`
Add post-auth side effects inside `onAuthStateChange`, fire-and-forget, non-blocking. Only on `SIGNED_IN` or `INITIAL_SESSION` with a valid user. Import from `postAuthInit.ts` and `fcm.ts`.

```ts
import { ensureAgentExists, syncLocationAfterAuth } from '@/utils/postAuthInit';
import { registerFCMToken } from '@/utils/fcm';

// Inside onAuthStateChange, after profile fetch is triggered:
if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
  // Fire-and-forget — never blocks UI
  Promise.resolve().then(async () => {
    try {
      await ensureAgentExists();
      registerFCMToken();
      syncLocationAfterAuth();
    } catch (e) {
      console.warn('[AuthInit] Non-blocking init error:', e);
    }
  });
}
```

Using `Promise.resolve().then(...)` ensures this runs after the current sync tick so it never delays the `set()` calls above it.

### Step 3 — `src/pages/Login.tsx`
- Remove local `ensureAgentExists()` and `syncLocationAfterAuth()` function definitions
- Remove the 3 call sites from `handleLogin` and `handleSignup`
- Remove `registerFCMToken` import (now handled by store)
- Keep `fetchProfileWithTimeout`, authentication logic, and navigation untouched

### Files changed
1. `src/utils/postAuthInit.ts` — new file (extracted functions)
2. `src/store/auth.ts` — add 3 imports + post-auth block in listener
3. `src/pages/Login.tsx` — remove side effect functions and call sites
