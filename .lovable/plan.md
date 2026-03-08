

## Plan: Fix Manual Payroll, Attendance Terminal, My Payslips, Time Schedule, and Form Asterisks

### 1. Fix Manual Payroll Dialog (`src/components/payroll/ManualPayrollDialog.tsx`)

**Current issues**: Work Details card is static/broken, fields are mismatched (e.g., "Late (mins)" maps to `night_differential`, "LWP" maps to `total_allowances`), contributions are editable, no auto-calculation.

**Changes**:
- Add new form fields: `late_minutes`, `lwp_days`, `lwop_days` (editable)
- When employee is selected, auto-fill `basic_pay` from employee record and set `days_worked` to a sensible default
- Use `calculateSalary` from `src/lib/salaryCalculations.ts` (or inline the contribution functions `computeSSS`, `computePhilHealth`, `computePagIBIG`) to auto-compute SSS, PhilHealth, Pag-IBIG based on basic salary
- Recalculate on every change to `days_worked`, `late_minutes`, or `lwp_days`
- Make SSS, PhilHealth, Pag-IBIG fields read-only (display only, not editable inputs)
- Fix the Work Details card to show actual values from the form (days worked, late mins, LWP, LWOP)
- Calculate: `basic_pay = (monthly_salary / 22) * days_worked`, late deduction, LWP earnings, LWOP deduction
- Gross = basic_pay + LWP earnings - late deduction
- Deductions = SSS + PhilHealth + PagIBIG + LWOP deduction
- Net = Gross - Deductions

### 2. Fix Attendance Terminal (`supabase/functions/rfid-attendance/index.ts`)

**Current issues**: 
- `dayOfWeek` uses `now.getDay()` which uses UTC, not PHT — could return wrong day
- Past-date recording not explicitly prevented (the `today` variable is correct in PHT, but day-of-week check uses UTC)

**Changes**:
- Fix `dayOfWeek` to use PHT timezone: parse the PHT date string to get the correct day of week instead of `now.getDay()`
- The attendance record already uses `today` (PHT date) so it only saves to current day — this is correct
- Add a comment clarifying that attendance is always for current PHT date only

**Frontend** (`src/pages/AttendanceTerminal.tsx`):
- After successful attendance, immediately refetch (already done via `useEffect` on `result?.success`)
- Ensure table is ordered by most recent first (already `ascending: false` on `created_at`)

### 3. Add Payslip View Modal on My Payslips (`src/pages/MyPayslips.tsx`)

**Changes**:
- Add an Eye icon button in the Action column next to the Download button
- Create a `PayslipViewDialog` component (inline or separate) that shows payslip details in a modal:
  - Employee info, pay period, pay date
  - Earnings breakdown (basic pay, overtime, holiday, allowances)
  - Deductions breakdown (SSS, PhilHealth, PagIBIG, tax, other)
  - Gross pay, total deductions, net pay
- Use existing payroll record data (already fetched)

### 4. Fix Time Input on Time Schedule (`src/pages/TimeSchedule.tsx`)

**Changes**:
- Increase the `w-24` class on time inputs to `w-32` or `w-[140px]` so the clock icon displays properly without being cut off

### 5. Red Asterisks on Positions and Branches Forms

**Positions** (`src/pages/Positions.tsx`):
- Change `Position Name *` label to use JSX with `<span className="text-destructive">*</span>`

**Branches** (`src/pages/Branches.tsx`):
- Same for `Branch Name *` and `Branch Code *` labels

### Files to Change

| File | Change |
|------|--------|
| `src/components/payroll/ManualPayrollDialog.tsx` | Redesign with auto-calculation, proper field mapping, read-only contributions |
| `supabase/functions/rfid-attendance/index.ts` | Fix PHT day-of-week calculation |
| `src/pages/MyPayslips.tsx` | Add eye icon + payslip view dialog |
| `src/pages/TimeSchedule.tsx` | Widen time input fields |
| `src/pages/Positions.tsx` | Red asterisks on required fields |
| `src/pages/Branches.tsx` | Red asterisks on required fields |

