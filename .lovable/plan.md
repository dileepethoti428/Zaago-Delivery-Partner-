
## Plan: Fix Authentication Lifecycle & Performance Issues

### Problems to Fix

1. **FCM crashes on web** — `PushNotifications` called without `Capacitor.isNativePlatform()` guard
2. **`onAppResume` resets state even when no session** — resets loaders and invalidates queries on every focus/visibility change regardless of auth state
3. **`initTheme` calls `get-agent-settings` before session exists** — fires immediately on mount, causes 401
4. **`useAssignedOrders` hooks have no session guard** — queries run without `enabled: !!session` check
5. **`useEarnings` hook has no session guard** — same issue
6. **`auth.initialize()` sets `loading: false` before `onAuthStateChange` listener fires** — causes brief unauthenticated flash
7. **`AuthInitializer` calls `getUser()` immediately on mount** to register FCM — fires before session is ready

### Changes

#### 1. `src/utils/fcm.ts`
- Add `Capacitor.isNativePlatform()` guard at the top of `registerFCMToken`
- If not native: log and return early — no PushNotifications calls on web

#### 2. `src/utils/appLifecycle.ts`
- In `onAppResume`: **check session first** before doing anything
  - `const { data } = await supabase.auth.getSession()`
  - If no session → skip `resetAllLoaders`, `unlockAllButtons`, `refreshSession`, `refreshQueries`
  - Only run the full resume flow when a session exists

#### 3. `src/providers/AppProviders.tsx`
- Move `initTheme()` call **inside** the `onAuthStateChange` callback (or gate it with `session?.user`) — not on raw mount
- Gate the FCM `getUser()` check to only run after auth initializes

#### 4. `src/hooks/useAssignedOrders.ts`
- Add `const { session } = useAuthStore()` to each hook
- Add `enabled: !!session?.access_token` to all 5 query hooks (`useTodayOrders`, `useTomorrowOrders`, `useUpcomingOrders`, `useDeliveredOrders`, `useAssignedOrders`)

#### 5. `src/hooks/useEarnings.ts`
- Add `const { session } = useAuthStore()` 
- Add `enabled: !!session?.access_token`

### What is NOT changed
- Business logic, UI rendering, navigation
- `useSettings.ts` already has `enabled: !!session?.access_token` ✓
- `useOrders.ts` already has `enabled: !!agentId` ✓
- `useLocationSyncController.ts` already guards on `session?.access_token` ✓
- Auth store `initialize()` logic — it's correct, the issue is upstream callers

### File Summary
| File | Change |
|------|--------|
| `src/utils/fcm.ts` | Add `Capacitor.isNativePlatform()` guard |
| `src/utils/appLifecycle.ts` | Gate `onAppResume` on session existence |
| `src/providers/AppProviders.tsx` | Gate `initTheme` and FCM on session; remove early `getUser()` call |
| `src/hooks/useAssignedOrders.ts` | Add `enabled: !!session` to all 5 hooks |
| `src/hooks/useEarnings.ts` | Add `enabled: !!session` |
