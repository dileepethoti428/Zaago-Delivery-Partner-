

# Scheduled Order Differentiation - Visual UI/UX Enhancement

## Overview

Scheduled orders (orders with specific delivery time slots or future dates) need a visually distinct UI compared to immediate orders so agents can quickly identify and plan their deliveries.

## Current State Analysis

### Backend Already Returns (lines 627-631 in get-available-orders)
```typescript
calculated_delivery_type: 'immediate' | 'scheduled' | 'subscription'
delivery_time_slot: '10:00-12:00' // format: HH:MM-HH:MM
delivery_date: '2025-02-04' // if future date
immediate_timing_config: { max_duration_minutes, slot_name } // for immediate only
```

### Frontend Gap
The `ZaagoOrder` type in `src/services/orders.ts` does NOT include these fields - they're being dropped during mapping.

---

## Implementation Plan

### Step 1: Extend ZaagoOrder Type

**File:** `src/services/orders.ts`

Add new fields to the ZaagoOrder type:

```typescript
export type ZaagoOrder = {
  // ... existing fields
  deliveryType?: 'immediate' | 'scheduled' | 'subscription';
  deliveryTimeSlot?: string;      // e.g., "10:00-12:00"
  deliveryDate?: string;          // e.g., "2025-02-04"
};
```

### Step 2: Map Backend Fields in fetchAvailableOrders

**File:** `src/services/orders.ts`

Update the mapping in `fetchAvailableOrders` (around line 94-114) to include:

```typescript
deliveryType: o.calculated_delivery_type || o.delivery_type || 'immediate',
deliveryTimeSlot: o.delivery_time_slot || undefined,
deliveryDate: o.delivery_date || undefined,
```

### Step 3: Create ScheduledBadge Component

**Create:** `src/components/order/ScheduledBadge.tsx`

A badge that shows for scheduled orders with time slot info:

```text
┌─────────────────────────────────┐
│ 📅 10:00 - 12:00               │
└─────────────────────────────────┘
```

Visual Design:
- Background: `bg-blue-50` (light mode) / `bg-blue-950` (dark mode)
- Border: `border border-blue-200`
- Text: `text-blue-700`
- Icon: Calendar icon from lucide-react

If future date, show date too:
```text
┌─────────────────────────────────┐
│ 📅 Tomorrow, 10:00 - 12:00     │
└─────────────────────────────────┘
```

### Step 4: Update OrderCard Component

**File:** `src/components/order/OrderCard.tsx`

Visual changes for scheduled orders:

1. **Left Border Accent**
   - Scheduled: `border-l-4 border-l-blue-500`
   - Immediate: No border (default look)
   - Subscription: `border-l-4 border-l-purple-500`

2. **Time Slot Display**
   - Show ScheduledBadge between customer name row and address section
   - Only visible for scheduled orders

3. **Card Layout Update**

```text
IMMEDIATE ORDER (current look):
┌────────────────────────────────────────────────────┐
│ Customer Name          [Open]           2.5 km    │
│                                                    │
│ 🔵 Pickup: Seller Address                          │
│ 🟢 Drop: Customer Address                          │
│                                                    │
│ ⏱ 15 min                               ₹30        │
│ [    Accept    ] [Reject]                          │
└────────────────────────────────────────────────────┘

SCHEDULED ORDER (new look):
┌─────────────────────────────────────────────────────┐
│ ▏Customer Name          [Open]           2.5 km    │
│ ▏                                                   │
│ ▏ 📅 10:00 - 12:00  (or "Tomorrow, 10:00-12:00")   │
│ ▏                                                   │
│ ▏ 🔵 Pickup: Seller Address                         │
│ ▏ 🟢 Drop: Customer Address                         │
│ ▏                                                   │
│ ▏ ⏱ 15 min                              ₹30        │
│ ▏ [    Accept    ] [Reject]                         │
└─────────────────────────────────────────────────────┘
   ↑
   Blue left border accent
```

### Step 5: Update memo comparison

**File:** `src/components/order/OrderCard.tsx`

Add `deliveryType` and `deliveryTimeSlot` to the memo comparison function to ensure re-renders when these change.

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/order/ScheduledBadge.tsx` | Time slot badge for scheduled orders |

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/orders.ts` | Add deliveryType, deliveryTimeSlot, deliveryDate to type + mapping |
| `src/components/order/OrderCard.tsx` | Add left border styling + ScheduledBadge display |

### Time Slot Formatting

Format the time slot for better readability:
- Raw: `10:00-12:00`
- Display: `10:00 AM - 12:00 PM`

Date formatting:
- Today: Just show time slot
- Tomorrow: "Tomorrow, 10:00 AM - 12:00 PM"
- Other dates: "Feb 5, 10:00 AM - 12:00 PM"

### Border Color Reference

```css
/* Scheduled Orders */
border-l-4 border-l-blue-500

/* Subscription Orders */
border-l-4 border-l-purple-500

/* Immediate Orders */
No special border (default card)
```

---

## UX Benefits

| Before | After |
|--------|-------|
| All orders look identical | Scheduled orders have blue accent + time slot |
| Agent must tap to see delivery time | Time slot visible at a glance |
| No visual hierarchy | Immediate orders feel "urgent", scheduled feel "planned" |

This helps agents:
1. **Plan their route** - See which orders have specific time windows
2. **Prioritize correctly** - Immediate orders need attention now, scheduled can wait
3. **Avoid missed windows** - Time slot is visible without tapping into details

---

## Summary

| Step | Action | File |
|------|--------|------|
| 1 | Extend ZaagoOrder type | `src/services/orders.ts` |
| 2 | Map backend fields | `src/services/orders.ts` |
| 3 | Create ScheduledBadge | `src/components/order/ScheduledBadge.tsx` |
| 4 | Update OrderCard styling | `src/components/order/OrderCard.tsx` |
| 5 | Update memo comparison | `src/components/order/OrderCard.tsx` |

