# Super Admin full access, schema sync, report date label

## 1. Super Admin gets full access
After first-time setup, the Super Admin can do everything an HR Admin can (add HR/employees, schedules, payroll, leaves, reports, settings), plus Super Admin-only actions.

- Server tasks currently accept only HR Admin: create employee, delete employee, compute payroll, send payslip emails, refresh leave credits, purge deleted employees. Change each to accept HR Admin or Super Admin, then redeploy.
- Database access rules that check only `hr_admin` (via `has_role(..., 'hr_admin')`) are switched to `is_admin()` so Super Admin passes too.
- Pages with direct `hr_admin` checks (Settings, Employees, EmployeeForm, Payroll, Reports, Leave Approvals, Leave Credits, sidebar, notifications) use the normalized role so Super Admin sees all buttons and menus.
- Role permissions: Super Admin always bypasses permission toggles.
- Verify by signing in as the Super Admin and creating a test employee and a schedule, then remove test data.

## 2. Keep the SQL schema file up to date
- Bring `supabase/schema/initial_schema.sql` in line with the current database now (including the changes above).
- Add a rule to project notes: every database change must also be written into that file in the same task.

## 3. Showing secret values
Saved secret values (GMAIL_APP_PASSWORD, GMAIL_USER, RFID_TERMINAL_SECRET) cannot be shown — not by me or in the app. You can replace any of them through a secure form, or view/edit them in Project Settings → Secrets. No code change.

## 4. Reports: "Generated:" becomes "Date:"
Change the label in the report PDF header (`PdfReportDocument.tsx`). Date format stays the same.
