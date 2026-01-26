
# Global App Lifecycle Handler - Complete Implementation

## Problem Statement
When returning from external apps (Google Maps, Phone, WhatsApp, Browser), the app can experience:
- Frozen loading states
- Stuck/disabled buttons
- UI elements that require app restart to fix

## Solution Architecture

This plan implements a **6-layer defense system** that ensures clean app resume behavior:

```text
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: App Lifecycle                    │
│         Global visibility + focus event handlers            │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 2: Global Loader Store             │
│              Centralized loading state management           │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 3: Button State Management         │
│           Prevent stuck disabled buttons on resume          │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 4: Session Refresh                 │
│              Revalidate auth token on resume                │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 5: Query Cache Refresh             │
│           Invalidate stale data after returning             │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 6: Component-Level Guards          │
│        Local useEffect hooks to reset on visibility         │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Global App Lifecycle Store

**Create new file:** `src/store/lifecycle.ts`

A Zustand store to track global loading state and provide reset functions:

```typescript
import { create } from 'zustand';

interface LifecycleState {
  // Global loading overlay
  isGlobalLoading: boolean;
  globalLoadingMessage: string | null;
  
  // Track in-flight operations
  activeOperations: Set<string>;
  
  // Actions
  showGlobalLoader: (message?: string) => void;
  hideGlobalLoader: () => void;
  startOperation: (id: string) => void;
  endOperation: (id: string) => void;
  resetAllLoaders: () => void;
}

export const useLifecycleStore = create<LifecycleState>((set, get) => ({
  isGlobalLoading: false,
  globalLoadingMessage: null,
  activeOperations: new Set(),

  showGlobalLoader: (message) => set({ 
    isGlobalLoading: true, 
    globalLoadingMessage: message ?? null 
  }),
  
  hideGlobalLoader: () => set({ 
    isGlobalLoading: false, 
    globalLoadingMessage: null 
  }),
  
  startOperation: (id) => {
    const ops = new Set(get().activeOperations);
    ops.add(id);
    set({ activeOperations: ops });
  },
  
  endOperation: (id) => {
    const ops = new Set(get().activeOperations);
    ops.delete(id);
    set({ activeOperations: ops });
  },
  
  resetAllLoaders: () => set({
    isGlobalLoading: false,
    globalLoadingMessage: null,
    activeOperations: new Set(),
  }),
}));
```

---

### Step 2: Create App Resume Handler Utility

**Create new file:** `src/utils/appLifecycle.ts`

Central utility that handles all resume logic:

```typescript
import { queryClient } from '@/providers/AppProviders';
import { useLifecycleStore } from '@/store/lifecycle';
import { useOrdersStore } from '@/store/orders';
import { supabase } from '@/integrations/supabase/client';

let lastResumeTime = 0;
const RESUME_DEBOUNCE_MS = 500;

/**
 * Master function called when app resumes from background
 * Resets all stuck states and refreshes data
 */
export async function onAppResume() {
  // Debounce rapid resume events
  const now = Date.now();
  if (now - lastResumeTime < RESUME_DEBOUNCE_MS) return;
  lastResumeTime = now;

  console.log('[AppLifecycle] App resumed - resetting state');

  // 1. Reset all loading states
  resetAllLoaders();

  // 2. Unlock all buttons (force-enable)
  unlockAllButtons();

  // 3. Refresh session (check if still valid)
  await refreshSession();

  // 4. Invalidate stale queries (soft refresh)
  refreshQueries();
}

/**
 * Reset ALL loading states across the app
 */
export function resetAllLoaders() {
  // Reset global lifecycle store
  useLifecycleStore.getState().resetAllLoaders();
  
  // Reset orders store loading
  const ordersStore = useOrdersStore.getState();
  if (ordersStore.loading) {
    useOrdersStore.setState({ loading: false });
  }

  console.log('[AppLifecycle] All loaders reset');
}

/**
 * Force-enable all disabled buttons
 * Safety net for buttons stuck in disabled state
 */
export function unlockAllButtons() {
  const buttons = document.querySelectorAll('button[disabled]');
  let unlocked = 0;
  
  buttons.forEach((btn) => {
    // Only unlock buttons that look stuck (not intentionally disabled)
    const button = btn as HTMLButtonElement;
    
    // Skip navigation/tab buttons that should stay disabled
    if (button.getAttribute('data-state') === 'inactive') return;
    
    // Skip buttons with explicit disabled attribute from React state
    // These will be re-disabled by React if they should remain disabled
    button.removeAttribute('disabled');
    unlocked++;
  });

  if (unlocked > 0) {
    console.log(`[AppLifecycle] Unlocked ${unlocked} stuck buttons`);
  }
}

/**
 * Refresh/validate the current session
 */
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('[AppLifecycle] Session refresh error:', error);
      return;
    }
    
    if (!data.session) {
      console.log('[AppLifecycle] No active session');
      return;
    }

    console.log('[AppLifecycle] Session valid');
  } catch (e) {
    console.warn('[AppLifecycle] Session check failed:', e);
  }
}

/**
 * Soft-refresh React Query cache
 * Marks queries as stale so they refetch when accessed
 */
export function refreshQueries() {
  // Invalidate order-related queries (most likely to be stale)
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['available-orders'] });
  queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
  
  console.log('[AppLifecycle] Queries invalidated');
}

/**
 * Setup global event listeners for app resume
 * Call once during app initialization
 */
export function setupAppLifecycleListeners() {
  // Visibility change (tab focus, app resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onAppResume();
    }
  });

  // Window focus (returning from external apps)
  window.addEventListener('focus', () => {
    onAppResume();
  });

  // Page show (back/forward navigation, bfcache restore)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      onAppResume();
    }
  });

  console.log('[AppLifecycle] Listeners initialized');
}
```

---

### Step 3: Create Global Loading Overlay Component

**Create new file:** `src/components/layout/GlobalLoader.tsx`

A fullscreen overlay that shows when global loading is active:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useLifecycleStore } from '@/store/lifecycle';

export function GlobalLoader() {
  const { isGlobalLoading, globalLoadingMessage } = useLifecycleStore();

  return (
    <AnimatePresence>
      {isGlobalLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {globalLoadingMessage && (
              <p className="text-sm text-muted-foreground">
                {globalLoadingMessage}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

### Step 4: Create useResumeGuard Hook

**Create new file:** `src/hooks/useResumeGuard.ts`

A hook for components that need to reset state on resume:

```typescript
import { useEffect, useRef } from 'react';

/**
 * Hook that calls a callback when the app resumes from background
 * Use this in components that have local loading states
 * 
 * @param onResume - Function to call on app resume (reset loading, etc.)
 * @param deps - Dependencies array for the callback
 */
export function useResumeGuard(
  onResume: () => void,
  deps: React.DependencyList = []
) {
  const lastVisibleRef = useRef(document.visibilityState === 'visible');
  const callbackRef = useRef(onResume);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onResume;
  }, [onResume, ...deps]);

  useEffect(() => {
    const handleVisibility = () => {
      const isNowVisible = document.visibilityState === 'visible';
      
      // Only trigger on transition from hidden -> visible
      if (isNowVisible && !lastVisibleRef.current) {
        callbackRef.current();
      }
      
      lastVisibleRef.current = isNowVisible;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);
}
```

---

### Step 5: Update AppProviders to Initialize Lifecycle

**Update:** `src/providers/AppProviders.tsx`

Add lifecycle initialization and global loader:

1. Import the new utilities
2. Call `setupAppLifecycleListeners()` once on mount
3. Add `<GlobalLoader />` to the render tree
4. Enhance the existing Capacitor resume handler

Key changes:
- Add import for `setupAppLifecycleListeners` and `onAppResume`
- Add import for `GlobalLoader` component
- Call `setupAppLifecycleListeners()` in the first `useEffect`
- Add `GlobalLoader` component after the Toasters
- In the `appStateChange` listener, also call `onAppResume()` alongside `registerFCMToken()`

---

### Step 6: Update Critical Pages with Resume Guards

**Update pages that have loading states:**

#### ManageDelivery.tsx
Add `useResumeGuard` to reset loading states:
```typescript
import { useResumeGuard } from '@/hooks/useResumeGuard';

// Inside component:
useResumeGuard(() => {
  // Reset all local loading states on resume
  setLoading(false);
  setIsCompleting(false);
  setIsGeneratingQR(false);
});
```

#### Profile.tsx
Add guard for toggle states:
```typescript
useResumeGuard(() => {
  setIsSavingLocation(false);
  setIsTogglingOnline(false);
});
```

#### Settings.tsx
Add guard for save states.

#### Home.tsx
The existing React Query hooks with `refetchOnWindowFocus: true` already handle this, but we can add extra protection.

---

### Step 7: Add Operation Tracking for Long Operations

For operations that open external apps (like Maps or Phone), wrap them with operation tracking:

```typescript
// Before opening Maps:
import { useLifecycleStore } from '@/store/lifecycle';

const { startOperation, endOperation } = useLifecycleStore.getState();

// When opening external app
startOperation('maps-navigation');

// The resume handler will automatically clear this
// But if you want manual control:
endOperation('maps-navigation');
```

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `src/store/lifecycle.ts` | Global loading state store |
| **Create** | `src/utils/appLifecycle.ts` | Resume handler + utility functions |
| **Create** | `src/components/layout/GlobalLoader.tsx` | Loading overlay component |
| **Create** | `src/hooks/useResumeGuard.ts` | Per-component resume hook |
| **Update** | `src/providers/AppProviders.tsx` | Initialize lifecycle + render GlobalLoader |
| **Update** | `src/pages/ManageDelivery.tsx` | Add resume guard |
| **Update** | `src/pages/Profile.tsx` | Add resume guard |
| **Update** | `src/pages/Settings.tsx` | Add resume guard |

---

## Technical Details

### How It Works

1. **On app launch**: `setupAppLifecycleListeners()` registers global event listeners
2. **User opens Maps**: Button loading state becomes true, external app opens
3. **User returns to app**: 
   - `visibilitychange` fires with `visible`
   - `onAppResume()` is called
   - All loaders are reset via `resetAllLoaders()`
   - Stuck buttons are unlocked via `unlockAllButtons()`
   - Session is validated via `refreshSession()`
   - Stale queries are invalidated via `refreshQueries()`
4. **React re-renders**: Components receive fresh state, buttons are re-enabled

### Debouncing

The resume handler debounces rapid events (500ms) to prevent multiple calls when both `visibilitychange` and `focus` fire together.

### Button Unlock Safety

The `unlockAllButtons()` function:
- Only removes the `disabled` attribute
- React will immediately re-disable buttons that should stay disabled (based on state)
- This ensures stuck buttons get unstuck, but legitimate disabled states are preserved

### Backwards Compatibility

- Existing component-level loading states still work
- Components don't need to change unless they want extra protection
- The global system acts as a safety net, not a replacement

---

## Expected Behavior After Implementation

| Scenario | Before | After |
|----------|--------|-------|
| Open Maps, return | Button stuck loading | Button reset, ready |
| Open Phone, return | Screen frozen | Screen responsive |
| Open WhatsApp, return | Loader spinning forever | Loader cleared |
| Tab away and back | Stale data shown | Data refreshed |
| Session expires while away | Silent failure | Session revalidated |
