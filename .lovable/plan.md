

## Plan: Four Fixes

### 1. My Attendance — Add "Payroll This Month" card
Based on the uploaded image, add a card below the Today's Summary section showing the employee's payroll total for the current month. The card will have the peso icon, "Payroll This Month" title, and display the sum of `net_pay` from the employee's approved/paid payroll records for the current month.

**File:** `src/pages/MyAttendance.tsx`
- Query `payroll_records` joined with `payroll_periods` for the current employee, filtering by current month and approved/paid status
- Add a card with `PhilippinePeso` icon styled like the uploaded reference image, placed below Today's Summary

### 2. Sidebar — Rename "DTR" to "My DTR"
**File:** `src/components/layout/AppSidebar.tsx`
- Line 151: Change `title: "DTR"` to `title: "My DTR"`

### 3. My Payslips — Remove columns from table
**File:** `src/pages/MyPayslips.tsx`
- Remove the `gross_pay` column (line 100)
- Remove the `total_deductions` column (line 101)
- Remove the `net_pay` column (line 102)

### 4. Dashboard — Fix "Payroll This Month" accuracy
**File:** `src/hooks/useDashboard.ts`
- Current issue: The query doesn't filter by payroll status (includes draft/processing periods) and has no upper month bound
- Fix: Filter to only `approved` or `paid` status periods, and add an end-of-month upper bound on `period_start`
- This ensures only finalized payroll data appears in the dashboard card

