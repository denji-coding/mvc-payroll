# Super Admin Account

## Goal
Introduce a built-in **Super Admin** that ships with the system, has unrestricted access, can manage HR Admins, and cannot be deleted or demoted by anyone else.

## Default Credentials (first-time only)
- Email: `superadmin@migrantsventure.com`
- Password: `Password`
- `must_change_password = true` → forced password change on first login (reuses existing `/change-password` flow)

## 1. Database changes (migration)

- Extend enum: `ALTER TYPE app_role ADD VALUE 'super_admin'`.
- Helper functions (SECURITY DEFINER):
  - `is_super_admin(_uid uuid) returns boolean`
  - `is_admin(_uid uuid) returns boolean` → true for `hr_admin` OR `super_admin` (used to widen existing checks without touching every policy by hand).
- Protection triggers on `user_roles`:
  - Block `DELETE` of a `super_admin` row.
  - Block `UPDATE` that changes a `super_admin` row's role.
  - Block `INSERT/UPDATE` that would leave zero active super admins.
  - Only existing super admins may insert a new `super_admin` row.
- Protection trigger on `auth.users` cannot be added (reserved schema); instead protect at app layer + via `profiles`/`employees` delete trigger that blocks removing the super admin's profile.
- Widen RLS: update HR-admin policies on `user_roles`, `role_permissions`, `settings`, `employees`, etc. to also allow `super_admin` (via the new `is_admin` helper where appropriate).
- Seed (idempotent) inside the migration using `auth.admin` via a `DO` block that:
  1. Checks if any user with email `superadmin@migrantsventure.com` exists.
  2. If not, inserts into `auth.users` with a bcrypted password for `Password`, email confirmed.
  3. Inserts matching `profiles` row with `must_change_password = true`.
  4. Inserts `user_roles` row with `role = 'super_admin'`.
- No `employees` row is created (Super Admin is a system account, not an employee — keeps it out of payroll/attendance/leave UIs).

## 2. App code changes

- `src/hooks/useAuth.tsx`: extend `AppRole` union with `'super_admin'`.
- `src/hooks/useViewMode.tsx`: treat `super_admin` as an admin view (same as `hr_admin`).
- `src/hooks/usePermissions.ts`: short-circuit to `true` for `super_admin` on every permission check.
- `src/components/layout/AppSidebar.tsx`: include `super_admin` in every place `hr_admin` is allowed; show all management sections.
- Existing pages already gated by `hr_admin` (Settings, Employees, EmployeeForm, Payroll, LeaveApprovals, LeaveCredits, Notifications hook, Leaves hook): change role checks from `role === 'hr_admin'` to `role === 'hr_admin' || role === 'super_admin'`.
- `src/pages/Employees.tsx`: hide Delete and Role-change actions for any row whose user has `super_admin` role; do not show the super admin in the employee list at all (since no employees row exists, this is automatic).
- User/role management UI (within Settings → Users or wherever HR admins are managed): only `super_admin` may assign/remove the `hr_admin` and `super_admin` roles; HR admins see role select limited to `employee`/`branch_manager`.
- Forced password change already handled by existing `must_change_password` + `/change-password` route — no new code needed there.

## 3. Safety guarantees

- DB triggers enforce "≥1 active super_admin" and "no demotion/deletion of super_admin".
- RLS prevents HR admins from touching the super_admin `user_roles` row.
- Seed is idempotent: re-running the migration will not duplicate or reset the account; password reset after first login persists.

## Technical notes

```text
roles
├── super_admin   (new, protected, seeded once)
├── hr_admin      (existing)
├── branch_manager
└── employee
```

Helper used widely:
```sql
create or replace function public.is_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('hr_admin','super_admin')
  )
$$;
```

Files touched (approx):
- new migration (enum, helpers, triggers, RLS updates, seed)
- `src/hooks/useAuth.tsx`, `useViewMode.tsx`, `usePermissions.ts`, `useNotifications.ts`, `useLeaves.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/pages/Settings.tsx`, `Employees.tsx`, `EmployeeForm.tsx`, `Payroll.tsx`, `LeaveApprovals.tsx`, `LeaveCredits.tsx`
- `src/integrations/supabase/types.ts` regenerates automatically after the migration
