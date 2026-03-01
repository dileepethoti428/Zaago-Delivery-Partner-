

# Rename "Agent" to "Partner" in All User-Facing Text

## Scope

Change all user-visible instances of "Agent" to "Partner" (and "agent" to "partner" where it appears in UI text). This does NOT change variable names, database columns, API endpoints, or internal code -- only what the user sees on screen.

## Files to Modify

### 1. `index.html` -- Page title and meta tags
- "Zaago Delivery Agent" -> "Zaago Delivery Partner"
- "Professional delivery agent app for drivers and couriers" -> "Professional delivery partner app for drivers and couriers"

### 2. `src/pages/Splash.tsx` -- Splash screen subtitle
- "Delivery Agent" -> "Delivery Partner"

### 3. `src/components/layout/ZaagoHeader.tsx` -- App header
- "Zaago Delivery Agent" -> "Zaago Delivery Partner"

### 4. `src/pages/Login.tsx` -- Login/signup screen
- "Zaago Delivery Agent" -> "Zaago Delivery Partner"
- "Sign in to your delivery agent account" -> "Sign in to your delivery partner account"
- "Join as a delivery agent" -> "Join as a delivery partner"
- "agent@zaago.com" placeholders -> "partner@zaago.com"

### 5. `src/pages/UploadDocuments.tsx` -- Document upload screen
- "Submit your documents to become a Zaago delivery agent" -> "Submit your documents to become a Zaago delivery partner"

### 6. `src/pages/Home.tsx` -- Home page
- "Your delivery agent profile is not set up" -> "Your delivery partner profile is not set up"

### 7. `src/pages/Profile.tsx` -- Profile page fallback name
- Fallback text 'Delivery Agent' -> 'Delivery Partner'

### 8. `src/pages/Deactivated.tsx` -- Deactivated account page
- "Your delivery agent account has been deactivated" -> "Your delivery partner account has been deactivated"

### 9. `src/pages/ManageDelivery.tsx` -- Cancel confirmation
- "released back to other agents" -> "released back to other partners"

### 10. `src/pages/PrivacyPolicy.tsx` -- Privacy policy subtitle
- "Delivery Agent App" -> "Delivery Partner App"

### 11. `src/pages/TermsConditions.tsx` -- Terms subtitle
- "Delivery Agent App" -> "Delivery Partner App"

### 12. `src/components/legal/TermsCheckbox.tsx` -- Legal dialog subtitles
- "Zaago Delivery Agent App" -> "Zaago Delivery Partner App" (2 instances)

### 13. `src/constants/legalContent.ts` -- Legal content
- Comment line: "Zaago Delivery Agent App" -> "Zaago Delivery Partner App"
- All user-facing legal text referencing "Agent" in display strings -> "Partner"
- "Delivery Agent Application" -> "Delivery Partner Application"
- "Delivery Agent App" -> "Delivery Partner App"

### 14. `src/utils/dateUtils.ts` -- Comment only
- "Delivery Agent App" -> "Delivery Partner App" (comment text)

## What stays unchanged
- All variable names (`agentId`, `agentProfile`, `currentAgentId`, etc.)
- All database table/column names (`delivery_agents`, `agent_id`, `agent_documents`)
- All Supabase Edge Function names and internal logic
- All store names and hook names (`useAgentGuard`, `useAgentSettings`, etc.)
- All file names (`agentSession.ts`, `agentProfile.ts`, etc.)
- Code comments referencing internal logic

