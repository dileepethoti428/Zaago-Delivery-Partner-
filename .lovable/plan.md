

# Fix: Buttons Stop Responding After Navigation or App Switch

## Root Cause

**Framer Motion's `motion.button` with `whileTap` is corrupting gesture state.** When you navigate between pages or switch apps, framer-motion's internal gesture tracking (pointer down/up events) gets interrupted mid-animation. The library thinks the button is still being "tapped" and swallows subsequent click events. This affects:

- **Every single `<Button>` in the app** (uses `motion.button` with `whileTap={{ scale: 0.96 }}`)
- **Tab bar navigation buttons** (`motion.button` with `whileTap={{ scale: 0.95 }}`)
- **Order detail action buttons** (`motion.div whileTap` wrappers)
- **Animated cards** (`whileTap` on card container)

The `unlockAllButtons()` function in the lifecycle handler only removes the `disabled` attribute -- it cannot fix framer-motion's stuck internal gesture state.

**Secondary issue**: `setupAppLifecycleListeners()` is called inside a `useEffect` without any deduplication guard. In React StrictMode, this registers duplicate event listeners (confirmed by console showing `[AppLifecycle] Listeners initialized` twice).

## Fix Plan

### 1. Replace `motion.button` with plain `<button>` in Button component

Use CSS `active:scale-[0.96]` and `transition-transform` instead of framer-motion for the tap effect. CSS active states reset naturally and never get stuck.

**File**: `src/components/ui/button.tsx`
- Remove `motion` import from framer-motion
- Remove `tapScale` import
- Change `motion.button` to plain `<button>`
- Add `active:scale-[0.96] transition-transform duration-100` to the `cva` base styles
- Remove `whileTap` prop

### 2. Replace `motion.button` in TabBar

**File**: `src/components/layout/TabBar.tsx`
- Change `motion.button` to plain `<button>`
- Add `active:scale-95 transition-transform` CSS classes
- Remove framer-motion import if no longer needed

### 3. Remove `whileTap` wrappers from OrderDetails

**File**: `src/pages/OrderDetails.tsx`
- Remove the `motion.div whileTap={{ scale: 0.98 }}` wrappers around buttons
- The buttons themselves will have the CSS active effect from the Button fix above

### 4. Remove `whileTap` from AnimatedCard

**File**: `src/components/ui/AnimatedCard.tsx`
- Remove `whileTap={tapScale.whileTap}` prop
- Add `active:scale-[0.98] transition-transform` to the Card's className instead

### 5. Fix duplicate lifecycle listeners

**File**: `src/utils/appLifecycle.ts`
- Add a `let listenersInitialized = false` guard in `setupAppLifecycleListeners()` to prevent registering listeners twice in StrictMode

## Why This Fixes It

| Problem | Cause | Fix |
|---------|-------|-----|
| Buttons unresponsive after page switch | framer-motion gesture state stuck mid-animation | Replace with CSS `active:` pseudo-class (resets automatically) |
| Buttons unresponsive after app switch | framer-motion pointer tracking interrupted | Same -- CSS has no persistent state |
| Duplicate lifecycle listeners | No guard against StrictMode double-mount | Add `listenersInitialized` flag |

## What Stays the Same

- Page transition animations (`motion.div` with `initial`/`animate`/`exit`) are fine -- those don't use gesture tracking
- Card entrance animations (`initial`/`animate`) are fine
- The tap feedback will look identical (scale to 96%) but use CSS instead of JS

