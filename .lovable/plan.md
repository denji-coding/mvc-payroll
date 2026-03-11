

## Plan: Payroll Overtime Exclusion, Half-Day Attendance, and Payslip Cleanup

### 1. Exclude overtime from payroll calculation & cap hours to schedule

**File:** `supabase/functions/compute-payroll/index.ts`
- For each employee, fetch their `employee_schedules` for each attendance day
- Calculate scheduled hours per day from schedule (morning duration + afternoon duration)
- Cap `hours_worked` per attendance record to the scheduled hours (ignore any extra time beyond schedule end)
- Remove `overtimePay` from gross pay calculation entirely (set to 0)
- Remove `overtime_hours` accumulation
- `grossPay = basicPay + totalAllowances + leavePay` (no overtime)

**File:** `supabase/functions/rfid-attendance/index.ts`
- On 4th punch (afternoon_out): cap `totalHours` to scheduled hours instead of raw clock difference
- Remove overtime_hours calculation; always store `overtime_hours: 0`
- Calculate scheduled hours: `(morningEnd - morningStart) + (afternoonEnd - afternoonStart)`
- If actual hours exceed scheduled, use scheduled hours

### 2. Remove "Add Manual Payroll" button & rename badge/header

**File:** `src/pages/Payroll.tsx`
- Remove the "Add Manual Payroll" button block (line ~263-264)
- Change `recordColumns` header from `'Type'` to `'Type of Calculation'`
- Change badge text from `'Computed'` to `'Automated'`

### 3. Half-day attendance logic (afternoon-only or morning-only)

**File:** `supabase/functions/rfid-attendance/index.ts`
- Current flow: 1st scan = morning_in, 2nd = morning_out, 3rd = afternoon_in, 4th = afternoon_out
- New logic: On 1st scan (no existing record), check current PHT time against schedule:
  - If current time >= `afternoonStart` (e.g., 13:00) and there's no morning record, create record with `morning_in: null`, `morning_out: null`, set `afternoon_in: currentTime` directly
  - This makes it a half-day (only afternoon session)
- On final punch, calculate hours based on which sessions are present:
  - Morning only (morning_in + morning_out, no afternoon): hours = morning duration, mark as half-day
  - Afternoon only (afternoon_in + afternoon_out, no morning): hours = afternoon duration, mark as half-day
  - Both sessions: hours = morning + afternoon durations
- For "morning only" completion: if employee has morning_out but no afternoon_in, and current time > afternoonEnd, the record stays as half-day. The 3rd scan still allows afternoon_in if within schedule.
- Cap hours to scheduled session hours (ties into item 1)

### 4. Remove overtime from My Payslips view modal

**File:** `src/pages/MyPayslips.tsx`
- Remove the overtime_pay conditional row (line 163)
- Remove holiday_pay, night_differential, and allowances rows (lines 164-166) — already should be hidden but verify
- Ensure only Basic Pay and Gross Pay show in earnings
- Add Late and LWP deduction rows (from `deductions_breakdown` or `other_deductions`) if > 0, matching the Payroll page payslip dialog pattern

### 5. Deploy updated edge functions

Both `compute-payroll` and `rfid-attendance` edge functions need redeployment after changes.

