Add a confirmation dialog before signing the user out to prevent accidental taps.

## Scope
- Profile.tsx — main Logout button on the Profile page
- Deactivated.tsx — Sign Out button for deactivated accounts
- PendingApproval.tsx — Logout button for pending approval accounts

## Implementation
Use the existing `AlertDialog` component (`src/components/ui/alert-dialog.tsx`) from Radix/shadcn.

For each file:
1. Import `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` from `@/components/ui/alert-dialog`.
2. Replace the direct logout `<Button>` with an `<AlertDialog>` wrapper:
   - The existing button becomes the `<AlertDialogTrigger>` (styled as before).
   - Dialog title: "Sign Out?"
   - Dialog description: "Are you sure you want to sign out?"
   - Footer actions: "Cancel" (outline) and "Sign Out" (destructive).
3. Keep the existing `handleLogout` logic, but wire it to the `<AlertDialogAction onClick={handleLogout}>`.

No new dependencies needed. No changes to auth store or logout logic itself.