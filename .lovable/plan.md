
## Changes to Settings Page

**1. Remove Notifications section** — Delete the entire Notifications `<Card>` block (lines 321–382), the `notificationsForm`, `onNotificationsSubmit`, `updateNotifications`, `testingNotification` state, `handleTestNotification` function, and clean up unused imports (`Bell`, `Send`, `useUpdateNotifications`, `notificationsSchema`, `NotificationsFormData`).

**2. Fix language selector** — The `onPreferencesChange` function does call `updatePreferences.mutate()` correctly, but the Select for language may not be wired properly (using `onValueChange` that calls `onPreferencesChange`). Need to verify line ~460+ for the language Select. The fix: ensure the language `Select` uses `onValueChange={(value) => onPreferencesChange('preferred_language', value)}` and default value is `'en'`.

**3. Remove Tamil, keep English/Hindi/Telugu** — Remove the `<SelectItem value="ta">Tamil</SelectItem>` option and keep only:
- English (`en`)
- Hindi (`hi`)  
- Telugu (`te`)

Let me read the rest of the file to see the language section.
