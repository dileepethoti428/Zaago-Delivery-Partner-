## Root cause
`delivery_time_slot` in the DB is a label string — one of `morning`, `morning-early`, `morning-late`, `evening-early`, `evening-late` — not a `HH:MM-HH:MM` range. The current `bucketOf()` in `MyDeliveries.tsx` tries to parse an hour with a regex and always returns `null`, so Morning/Evening counts are always 0.

## Fix
Update `bucketOf()` in `src/pages/MyDeliveries.tsx` to classify by label prefix:

- Starts with `morning` → `morning`
- Starts with `evening` → `evening`
- Otherwise → `null` (only visible under "All")

Remove the now-unused `getSlotStartHour` helper. Keep `getDefaultTimeBucket()` unchanged (time-of-day based default).

No other files or backend changes needed.
