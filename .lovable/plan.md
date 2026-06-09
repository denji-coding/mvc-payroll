
# Consolidated Schema Export (Reference Only)

## Goal
Produce one self-contained PostgreSQL/Supabase SQL file that reproduces the **current** HRM & Payroll schema exactly, so it can bootstrap a brand-new Supabase project. The file will be saved into the repo for reference and **will not** be executed against this database.

## Deliverable
- New file: `supabase/schema/initial_schema.sql`
- Single migration file, idempotent (safe to re-run)
- Includes a header comment block explaining intent ("reference export — do not run against the live project")

## Contents (in order)

1. **Extensions** — `pgcrypto`, `pg_cron`, `pg_net` (used by scheduled tasks / triggers).
2. **Enums** (guarded with `DO $$ ... EXCEPTION WHEN duplicate_object`):
   - `app_role` (super_admin, hr_admin, branch_manager, employee)
   - `employment_status` (active, inactive, terminated)
   - `leave_type`, `leave_status`, `payroll_status`, `notification_type`
3. **Utility functions**:
   - `public.update_updated_at_column()` — generic `updated_at` trigger
   - `public.handle_new_user()` — auto-creates profile + default employee role on `auth.users` insert
4. **Tables** (all `CREATE TABLE IF NOT EXISTS`, with `TIMESTAMPTZ`, `created_at`, `updated_at` where applicable, FK constraints, unique keys, and indexes):
   - `profiles`, `user_roles`, `role_permissions`
   - `branches`, `branch_managers`, `positions`
   - `employees`, `employee_schedules`, `employee_salary_adjustments`
   - `attendance` (4-punch columns), `holidays`
   - `leave_types`, `leave_credits`, `leave_requests`
   - `salary_components`, `payroll_periods`, `payroll_records`, `loans`
   - `announcements`, `notifications`, `settings`, `password_reset_tokens`
   - For each table: `GRANT` block (authenticated + service_role; anon only where current policies allow)
5. **Domain functions** (security definer, `SET search_path = public`):
   - `has_role`, `is_admin`, `is_super_admin`
   - `get_employee_by_user`, `get_user_branch_id`
   - `assign_leave_credits_to_employee`
   - `prevent_overlapping_approved_leaves`
   - `protect_super_admin_role`, `protect_super_admin_profile`
   - Notification triggers: `notify_hr_on_leave_request`, `notify_employee_on_leave_update`, `notify_employee_on_attendance`, `notify_employees_on_announcement`, `notify_employees_on_payroll_approved`
6. **Triggers** — attach all functions to their tables (`updated_at`, `on_auth_user_created`, leave overlap, super-admin protection, notification fan-outs).
7. **RLS** — `ENABLE ROW LEVEL SECURITY` + every policy currently in the database, reproduced verbatim per role.
8. **Storage** — `INSERT ... ON CONFLICT DO NOTHING` for the `employee-avatars` (public) and `medical-certificates` (private) buckets, plus their object policies.
9. **Seed data** (idempotent via `ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`):
   - `leave_types` — default Sick, Vacation, Emergency, Maternity, Paternity, Bereavement, Unpaid
   - `role_permissions` — default permission matrix
   - `settings` — default keys (attendance grace periods, statutory toggles, company info)
   - Note: the Super Admin auth user **cannot** be seeded portably via SQL (requires `auth.admin`) — a clearly marked comment block will document the manual step / link to the existing `20260607121832_*.sql` seed migration for projects that want it.

## Process

During build mode I will:
1. Query the live database for the exact definitions I don't already have in context (enum values, indexes, unique constraints, storage policies, current seed rows for `leave_types` / `role_permissions` / `settings`) using `supabase--read_query`.
2. Assemble the SQL in `supabase/schema/initial_schema.sql`.
3. Do **not** call `supabase--migration` — nothing is executed against this database.

## Out of scope
- No changes to existing live migrations, tables, data, or app code.
- No edge functions (`supabase/functions/*`) are bundled — they live as separate Deno files and deploy independently.
- No execution against the current project's database.
