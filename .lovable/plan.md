
## Findings

### Question 1: Is rating the average of ALL orders?

**Current state**: The `average_rating` in `delivery_agents` IS calculated as `AVG(rating)` from `delivery_agent_ratings` table — but there is a **real problem right now**:

- Dileep has **5 ratings** (1, 1, 1, 2, 5) → correct average = **2.0** but `delivery_agents.average_rating` still shows **5.00** (the old backfilled value from before today's new 1-star and 2-star ratings)
- The trigger `update_agent_rating_after_insert` was created by our migration, BUT there was already another trigger called `trigger_update_delivery_agent_rating_stats` — this older trigger is also firing and **may have a conflict** or the order of firing is wrong
- Net result: new ratings inserted after the migration did NOT update the stored average from 5.0 → 2.0

**Root cause of mismatch**: The backfill only ran once at migration time. But new ratings came in after, and somehow the stored value is NOT being updated. The trigger exists and is enabled — need to check if there's a conflict between the two duplicate triggers.

**Fix needed**: Remove the duplicate trigger (keep only one), and re-run the backfill to sync Dileep's current actual average of 2.0.

### Question 2: How is Performance Score calculated?

**Answer**: The `performance_score` column has a **default value of 100** and is **never updated by any function or trigger**. There is NO calculation logic — every agent always shows 100%. It is a static placeholder that was never implemented.

**What it should ideally factor in** (common delivery partner scoring):
- Customer rating (e.g. 40% weight)
- Delivery success rate / completion rate (e.g. 40% weight)  
- On-time delivery rate (e.g. 20% weight)

**Honest answer to show the user**: The score is currently always 100% — it's not being calculated from any real data. Two options:
1. Hide the performance score tile since it shows misleading data
2. Implement a real calculation based on available data

### Plan

**Fix 1: Duplicate trigger conflict** — drop the old duplicate trigger, keep only the one we created. Then re-sync the current averages.

**Fix 2: Profile UI** — Add a tooltip/label under "Score" that explains it honestly, OR hide the score tile and replace it with a "Total Ratings" count which IS real data.

**Migration changes**:
```sql
-- Remove duplicate trigger
DROP TRIGGER IF EXISTS trigger_update_delivery_agent_rating_stats ON public.delivery_agent_ratings;

-- Re-sync averages (Dileep should now show 2.0 not 5.0)
UPDATE public.delivery_agents d
SET average_rating = sub.avg_rating, updated_at = now()
FROM (
  SELECT agent_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating
  FROM public.delivery_agent_ratings
  GROUP BY agent_id
) sub
WHERE d.id = sub.agent_id;
```

**Frontend change (Profile.tsx)**:
- Replace the misleading "Score: 100%" tile with "Reviews: X" count — showing how many customers have rated the agent (real, useful data)
- The rating tile already correctly shows `average_rating`

### Files to change
1. **Migration** — drop duplicate trigger, re-sync average ratings
2. **`src/pages/Profile.tsx`** — replace "Score %" stat with "Reviews" count (total number of customer ratings)

No edge function changes needed.
