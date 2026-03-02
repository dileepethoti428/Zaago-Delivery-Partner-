
## Two targeted changes to `src/providers/AppProviders.tsx`

### Fix 1 — Delay lifecycle setup until auth is ready (line 84–85)
Replace the immediate `setQueryClientRef` + `setupAppLifecycleListeners()` calls with a Zustand subscription that waits for `loading` to become `false` before activating lifecycle listeners. This ensures no lifecycle handler runs while auth is initializing or login is in flight.

```typescript
// BEFORE
setQueryClientRef(queryClient);
setupAppLifecycleListeners();

// AFTER
const unsubscribeLifecycle = useAuthStore.subscribe((state) => {
  if (!state.loading) {
    setQueryClientRef(queryClient);
    setupAppLifecycleListeners();
    unsubscribeLifecycle();
  }
});
```

We also need to return the unsubscribe in the cleanup (or it self-unsubscribes once triggered, which is fine).

### Fix 2 — Guard `onAppResume` call with auth loading check (line 134–143)
Inside the `appStateChange` listener, add an auth loading check before calling `onAppResume()`. This is a belt-and-suspenders guard for the case where the Capacitor listener fires after lifecycle is set up but during a subsequent login (e.g., after sign-out and re-login).

```typescript
// BEFORE
if (isActive) {
  setTimeout(() => { onAppResume(); }, 500);
  ...
}

// AFTER
if (isActive) {
  const { loading } = useAuthStore.getState();
  if (!loading) {
    setTimeout(() => { onAppResume(); }, 500);
  }
  const user = useAuthStore.getState().user;
  if (user) {
    registerFCMToken();
  }
}
```

### Only file changed: `src/providers/AppProviders.tsx`
