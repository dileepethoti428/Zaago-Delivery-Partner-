

## Fix: Restore Correct Pricing in `complete_delivery_zepto` RPC

### Problem
During the recent RPC rewrites to fix FK errors, the pricing constants got changed incorrectly:
- **Current (broken):** Base ₹25, Distance ₹7/km, uses `ceil()` rounding
- **Correct:** Base ₹10, Distance ₹8/km, round to 1 decimal place

Every other part of the system (edge functions, frontend, shared pricing module) uses ₹10 + ₹8/km. Only the RPC is wrong.

Tips are already working correctly in the RPC (line 88-90) and UI — they just show wrong totals because of the wrong base/rate.

### Fix
One database migration to update two lines in the RPC:

```sql
-- Line 20-21 change:
v_base_pay numeric := 10;     -- was 25
v_per_km_rate numeric := 8;   -- was 7

-- Line 89 change:
v_rounded_distance := round(v_distance_km::numeric, 1);  -- was ceil()
```

### What stays the same
- Tip logic (already correct)
- FK handling (already fixed)
- Auth validation (already fixed)
- All edge functions and frontend (already use ₹10 + ₹8/km)

### Files
- Database migration only — recreate `complete_delivery_zepto` with corrected pricing constants and rounding

