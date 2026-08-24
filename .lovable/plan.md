# Add Contact Number to Create Account Page

## Goal
Collect the delivery partner's phone number on the "Create account" (signup) tab alongside email and password, and persist it to the existing `phone` columns in `profiles` and `delivery_agents`.

## Why
The phone is currently collected only on the Upload Documents page. Capturing it at signup lets admins/support reach the partner earlier in the onboarding flow and pre-fills the document form.

## Changes

### 1. Validation schema
**File:** `src/utils/validation.ts`
- Extend `signupSchema` with `phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number')`.
- Add `phone` to `SignupFormData`.

### 2. Signup UI
**File:** `src/pages/Login.tsx`
- Add a "Phone Number" input field to the signup form, placed below the email field.
- Use the existing `Input` + `Label` pattern and show validation errors.
- Keep the field optional visually but enforce validation when touched.

### 3. Signup handler
**File:** `src/pages/Login.tsx`
- After creating the auth user and inserting the `profiles` row, include `phone: data.phone` in the profile insert.
- Update the `delivery_agents` upsert to also set `phone: data.phone` if a record is created.
- If the profile insert fails due to a phone-related issue, surface a clear toast.

### 4. Document upload pre-fill (nice-to-have)
**File:** `src/pages/UploadDocuments.tsx`
- If `profile?.phone` already exists, pre-fill the phone field in the document form so the partner does not re-enter it.

## Acceptance criteria
- Signup form shows a phone number field.
- Invalid phone numbers (wrong length, starting below 6) show an inline error.
- On successful signup, the phone is stored in `profiles.phone` and `delivery_agents.phone`.
- Existing login and reset-password flows remain unchanged.
