

# Plan: Employee Fixes, Leave Credit Improvements, and Reports Cleanup

## 1. Fix Employee Form Duplicate Error Messages

### Edge Function (`supabase/functions/create-employee/index.ts`)
- Before creating the auth user, check for duplicates in the `employees` table: email, phone, rfid_card_number, sss_number, philhealth_number, pagibig_number
- Return specific error messages like "An employee with this email already exists", "An employee with this phone number already exists", etc.
- Also catch the Supabase Auth duplicate email error and return a clearer message

### Employee Edit Form (`src/pages/EmployeeForm.tsx`)
- On update, before saving, query for duplicates (excluding current employee ID) for email, phone, RFID, and government IDs
- Show specific toast error messages for each duplicate field

### Date Picker Auto-Close (`src/components/ui/date-picker.tsx`)
- Add open/close state control to the `Popover` in `DatePicker`
- When `onSelect` fires on the Calendar, close the popover automatically

## 2. Permanent Delete on Deleted Tab + 6-Month Expiry

### Employees Page (`src/pages/Employees.tsx`)
- Add a permanent delete button (Trash2 icon) in the "deleted" tab actions alongside the restore button
- Add confirmation dialog warning this is irreversible
- The handler calls the edge function or directly deletes (via a new edge function) the employee and their auth user

### Edge Function (`supabase/functions/delete-employee/index.ts`) — New
- Accepts employee ID, verifies HR admin role
- Deletes the employee record and their auth user via `supabaseAdmin.auth.admin.deleteUser()`
- Cleans up related records (attendance, leave_requests, leave_credits, payroll_records, etc.)

### 6-Month Auto-Purge — Database
- Create a database function `purge_expired_deleted_employees()` that deletes employees where `employment_status = 'terminated'` and `updated_at < now() - interval '6 months'`
- Set up a `pg_cron` job to run this monthly
- The function will also need to call auth admin to delete users, so this is better handled as a cron-triggered edge function

### Edge Function (`supabase/functions/purge-deleted-employees/index.ts`) — New
- Queries terminated employees older than 6 months
- Deletes their auth accounts and employee records
- Scheduled via `pg_cron` + `pg_net`

## 3. Leave Credit Fixes

### Leave Type Creation (`src/hooks/useLeaveTypes.ts`)
- Fix `useCreateLeaveType`: when `applyToAll` is true, use the correct `default_credits` value from the newly created leave type
- The current code already does this correctly, but the enum mapping may fail for custom leave types — fix the mapping to handle custom types properly

### Database Trigger for Auto-Assignment
- The existing `assign_leave_credits_to_employee` trigger already assigns credits on employee creation
- Need to ensure new leave types also get assigned — the `useCreateLeaveType` hook handles this with `applyToAll`

### Monthly Credit Refresh Logic
- Create a new edge function `refresh-leave-credits/index.ts` that runs monthly via `pg_cron`
- Logic: For each employee's leave credit record:
  - If `used_credits > 0`: reset `used_credits` to 0 (refresh consumed credits)
  - If `used_credits = 0`: do nothing (balance stays the same, doesn't increase)
- Schedule via `pg_cron` on the 1st of each month

## 4. Remove Branch Performance from Reports

### Reports Page (`src/pages/Reports.tsx`)
- Remove the `branch-performance` entry from the `reports` array
- Remove the `case 'branch-performance'` block from `generateReport`
- Remove the `Building2` import if no longer used

## Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/functions/create-employee/index.ts` | Add duplicate checks before creating |
| `src/pages/EmployeeForm.tsx` | Add duplicate validation on edit |
| `src/components/ui/date-picker.tsx` | Auto-close popover on date selection |
| `src/pages/Employees.tsx` | Add permanent delete button in deleted tab |
| `supabase/functions/delete-employee/index.ts` | New — permanent delete with auth cleanup |
| `supabase/functions/purge-deleted-employees/index.ts` | New — cron job for 6-month expiry |
| `src/hooks/useLeaveTypes.ts` | Fix enum mapping for custom leave types |
| `supabase/functions/refresh-leave-credits/index.ts` | New — monthly credit refresh |
| `src/pages/Reports.tsx` | Remove branch performance section |
| Database | Enable `pg_cron`/`pg_net`, schedule purge + refresh jobs |

## Implementation Order
1. Date picker auto-close (quick fix)
2. Reports page cleanup (quick fix)
3. Employee form duplicate validation (edge function + frontend)
4. Permanent delete feature (new edge function + UI)
5. Leave credit fixes (enum mapping + new refresh edge function)
6. Cron jobs for auto-purge and credit refresh

