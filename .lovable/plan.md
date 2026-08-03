## Goal

Clean up unused database structures without breaking any working feature, and standardize how employee names appear in notifications.

## 1. Database cleanup

**Employees table** — drop `department`, `tin_number`, `bank_name`, `bank_account_number`. These are already excluded from the employee form and view modal per the project's simplified data model. Before dropping, remaining references in code (payslip email, payroll PDF, reports, data-dictionary PDF, `create-employee` function) will be updated so nothing selects the removed columns.

**Attendance table** — drop `time_in` and `time_out`. Verified they are still referenced in:
- `supabase/functions/rfid-attendance/index.ts` (writes both legacy and 4-punch columns)
- `supabase/functions/compute-payroll/index.ts`
- `src/pages/ClockInOut.tsx`, `src/hooks/useClockInOut.ts` (legacy self-service page)
- `src/pages/Attendance.tsx`, `src/pages/MyAttendance.tsx`, `src/pages/Reports.tsx`, `src/hooks/useAttendance.ts`, `src/hooks/useEmployeeDashboard.ts`, `src/hooks/useAttendanceTerminal.ts`, `src/pages/AttendanceTerminal.tsx`

Each of these will be switched to derive first punch = `morning_in` (fallback `afternoon_in`) and last punch = `afternoon_out` (fallback `morning_out`) before the columns are dropped. The `notify_employee_on_attendance` trigger function will be rewritten to fire on the 4-punch columns instead. The legacy Clock In/Out page and hook are removed.

**Loans table** — dropped. References cleaned from `delete-employee` and `purge-deleted-employees` edge functions.

Order of work: code first, then a single migration that drops the columns/table and updates the trigger function, then regenerate types and re-verify.

## 2. Attendance Terminal safety

The terminal only sends the card/employee identifier and displays the returned action label, so dropping the legacy columns does not affect it once `rfid-attendance` writes only the 4-punch columns. Punch sequence, cooldown, validations, and the feedback overlay stay exactly as they are.

## 3. Notification employee names

All notification text will use the standardized display format `First M. Last Suffix` (e.g. `John M. Perez`, `Juan D. Cruz Jr.`).

- New notifications: the trigger functions that build messages (leave request to HR, leave approval/rejection, announcements, payroll ready, attendance) will compose the name from `first_name`, middle initial, `last_name`, and `suffix_name`.
- Existing notifications: formatting is applied at display time in the notifications UI, so stored rows are not rewritten. No underlying employee data changes.

## Technical notes

- Column/table drops and trigger updates go through one reviewed migration; all dependent code is updated in the same change set.
- `supabase/schema/initial_schema.sql` (the reference schema) is updated to match.
- No changes to payroll math, leave credit deduction, RLS policies, or any UI outside the files listed above.
