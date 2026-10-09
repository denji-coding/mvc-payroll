# Fix first-time admin setup on a fresh system

## Problem
On a brand-new system with no data, the "First-Time Setup" form either does not appear or fails when submitted:
- The login page asks the database "does any admin exist?", but the fresh-install schema file does not create that check. The check fails, and the page falls back to hiding the setup form.
- The setup function only gives the new account the HR Admin role. That works against the Super Admin protection rules, and it doesn't let the first account be the protected Super Admin.
- When setup fails, the error message is hidden behind a generic "Setup failed".

## Fix
1. **Fresh-install schema**: add the missing "does any admin exist" check to the schema file, and allow logged-out visitors to run it (it only answers yes or no).
2. **Live database**: add a migration that makes sure the check exists and logged-out visitors can run it.
3. **Setup function**:
   - Make the first account a **Super Admin** (full access, cannot be deleted).
   - Create or update the account's role row reliably, even if the automatic role row is missing.
   - If any step fails, remove the half-created account.
   - Return clear error messages, such as "email already registered" or "password too short".
   - Redeploy the function.
4. **Login page**:
   - If the check itself fails, show the setup form with a warning instead of hiding it.
   - Show the real error message from the setup function.
5. **Check it works**: call the setup function and confirm it refuses a second setup once an admin exists. No real accounts are created during the check.

## Technical details
- `public.has_any_admin()`: SECURITY DEFINER, `GRANT EXECUTE ... TO anon, authenticated`.
- In `setup-first-admin`: upsert into `user_roles` with role `super_admin` using the service role, which the protect trigger allows. Also set `must_change_password=false`. Decode the error body on the client, following the existing edge-function error-handling rule.
- Files: `supabase/schema/initial_schema.sql`, `supabase/functions/setup-first-admin/index.ts`, `src/pages/Auth.tsx`, plus one new migration.
