Add show/hide password toggle (eye icon) to all password inputs on the Login page.

Changes:
1. Import `Eye` and `EyeOff` from `lucide-react` in `src/pages/Login.tsx`.
2. Add `useState` booleans for each password field visibility:
   - `showLoginPassword`
   - `showSignupPassword`
   - `showConfirmPassword`
3. Wrap each password `<Input>` in a `relative` container.
4. Add an absolute-positioned `<button type="button">` with the Eye/EyeOff icon to the right of each input.
5. Toggle the `type` prop between `"password"` and `"text"` based on the state.

This uses the same pattern already present in `src/pages/ResetPassword.tsx`. No other files are affected.