

## Plan: Update Manual Payroll Dialog

### Changes to `src/components/payroll/ManualPayrollDialog.tsx`

1. **Replace "Monthly Salary" with "Daily Rate"** — Display `monthlySalary / 22` instead of the monthly salary in the Work Details card.

2. **Auto-populate "Days Worked" from employee schedule** — Fetch the selected employee's schedule using `useEmployeeScheduleByEmployee`, count duty days (`is_duty_day === true`), and use half that count (semi-monthly) as the default `daysWorked` value when an employee is selected. This reflects the real number of duty days per pay period.

3. **Fix LWP calculation** — LWP of 1 day = 1 day's salary (daily rate). The current `calculateSalary` function already computes `leaveWithPayEarnings = dailyRate * lwpDays`, which is correct. However, we need to ensure LWP days are **added on top of** the basic pay from days worked (not already included in days worked). The current logic already does this — LWP earnings are separate from basic pay. No change needed to `salaryCalculations.ts`.

### Technical Details

- Import `useEmployeeScheduleByEmployee` from `@/hooks/useEmployeeSchedule`
- Use `useEffect` on `employeeId` change to set `daysWorked` to the count of duty days divided by 2 (semi-monthly)
- Change the "Monthly Salary" label to "Daily Rate" and display `fmt(dailyRate)` instead of `fmt(monthlySalary)`

