
## Root Cause: `total_amount` column does not exist — it's called `total`

### The Bug (one wrong column name)

In `supabase/functions/unified-complete-delivery/index.ts` line 276:

```typescript
.select('id, status, subscription_id, payment_status, seller_id, total_amount')
```

But the actual `orders` table schema (confirmed from `types.ts` line 4020) has:
- `total` ← correct column name
- `total_amount` ← does NOT exist → causes Postgres error `42703`

This makes the function return early with `"❌ Order not found"` because `orderCheckError` is set, even though the order exists fine. The delivery completion never reaches the RPC call.

### Fix: One word change in the SELECT query

**`supabase/functions/unified-complete-delivery/index.ts`** — line 276:
```typescript
// Before (broken)
.select('id, status, subscription_id, payment_status, seller_id, total_amount')

// After (fixed)
.select('id, status, subscription_id, payment_status, seller_id, total')
```

And line 290 where the value is read:
```typescript
// Before
totalAmount = orderCheck.total_amount || 0;

// After
totalAmount = orderCheck.total || 0;
```

### Files to change
1. **`supabase/functions/unified-complete-delivery/index.ts`** — two lines (276 and 290): replace `total_amount` with `total`

That's the entire fix. No DB migration needed — the column already exists with the right name, the edge function just had the wrong name.
