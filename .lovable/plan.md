
## Rename "Agent" → "Partner" Across All UI Text

All files needing changes (UI text only, no code/variable changes):

| File | Change |
|------|--------|
| `index.html` | Title, description, og:title, og:description |
| `src/pages/Splash.tsx` | "Delivery Agent" → "Delivery Partner" |
| `src/pages/Login.tsx` | "Zaago Delivery Agent" heading + 2 CardDescriptions |
| `src/components/layout/ZaagoHeader.tsx` | Header title |
| `src/pages/PrivacyPolicy.tsx` | subtitle prop |
| `src/pages/TermsConditions.tsx` | subtitle prop + "Delivery Agent App" subtext |
| `src/components/legal/TermsCheckbox.tsx` | 2 subtitle props |
| `src/pages/UploadDocuments.tsx` | CardDescription text |
| `src/pages/Home.tsx` | "Your delivery agent profile..." message |
| `src/pages/Deactivated.tsx` | CardDescription |
| `src/pages/Profile.tsx` | Fallback display name |
| `src/constants/legalContent.ts` | All "Delivery Agent" references in legal text |

Internal code stays untouched: `delivery_agents` table refs, variable names, function names, etc.
