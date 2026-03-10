

## Plan: Multiple Fixes and Improvements

### 1. Remove "Employee Portal" section from sidebar for HR admin view
**File:** `src/components/layout/AppSidebar.tsx`
- When `effectiveRole === 'hr_admin'` (admin view), hide the entire "Employee Portal" sidebar group. The employee portal items should only show when the HR admin has switched to employee view mode via the footer dropdown toggle.
- The toggle button in the footer dropdown already exists and stays.

### 2. Remove "My Leaves" from HR admin's employee portal view
**File:** `src/components/layout/AppSidebar.tsx`
- In `employeePortalItems`, remove `hr_admin` from the `roles` array of the "My Leaves" item, OR filter it out when effectiveRole is employee but actualRole is hr_admin.
- HR admins should not see "My Leaves" even in employee portal mode.

### 3. Payroll page changes
**File:** `src/pages/Payroll.tsx`

**a) Rename "Approve" → "Process" button:**
- Change the button label from "Approve" to "Process" (line ~80-81)
- Change the pending text from "Approving..." to "Processing..."
- Rename the `approved` badge text to `processed` in `getStatusBadge`

**b) Hide "Add Manual Payroll" button when period is `draft` (not yet run):**
- Currently shows when `status === 'draft'` (line 189). Change condition: only show when `status === 'processing'` (i.e., after "Run" has been executed).

**c) Payslip view modal — remove Overtime, Holiday, Allowance, Tax; show Late/LWP if present:**
- In `PayslipDialog`, remove the Overtime, Holiday, Allowances rows from Earnings and Tax row from Deductions.
- Add conditional Late deduction row (from `other_deductions`) and LWP row (from `total_allowances`) if > 0.

**d) Salary Calculator — remove extra fields and breakdown items:**
- **File:** `src/components/payroll/SalaryCalculator.tsx`
  - Remove inputs: Overtime Hours, Additional Allowances, Loan Deductions, Other Deductions
  - Remove from computation breakdown: Overtime Pay, Allowances, Withholding Tax, Loan Deductions, Other Deductions
  - Update `SalaryCalculationInput` usage to pass 0 for removed fields
  - Add Late Minutes and LWP fields to match manual calculation

**e) Monthly payroll restriction — disable creating new period if month already has a processed payroll:**
- When creating a new period, check existing periods for the same month. If any has status `processing` or `processed`/`approved`, disable creation for that month.
- In the create period dialog, validate selected dates against existing periods.

**f) Add filter tabs (All, Draft, Processing, Processed) to payroll periods table:**
- Add a secondary tab-like filter bar above the periods DataTable with options: All, Draft, Processing, Processed
- Filter the `periods` data based on selected filter

**g) Change "approved" badge label to "processed":**
- In `getStatusBadge`, map `approved` → display as "processed"

### 4. Leave Credits — add "Both" option for required fields + reset form on close
**File:** `src/pages/LeaveCredits.tsx`
- In the `handleRequiredFieldChange` function, add a `'both'` option that sets `required_fields` to `['reason', 'upload']`
- Add `<SelectItem value="both">Both (Reason & Upload)</SelectItem>` to the Select
- Update `currentFieldValue` logic to detect when both are present
- On dialog close (`onOpenChange`), reset form to `defaultForm`

### 5. Employee form responsiveness
**File:** `src/pages/EmployeeForm.tsx`
- Change `max-w-6xl` container to full width or `max-w-full` so it uses available screen space
- Ensure grid columns expand on larger screens (e.g., `lg:grid-cols-4`)

### 6. Notification click → navigate to relevant page + mark as read
**File:** `src/components/layout/AppHeader.tsx`
- Import `useNavigate` from react-router-dom
- On notification click, call `markAsRead(id)` AND navigate based on `reference_type`:
  - `leave_request` → `/leave-approvals`
  - `payroll` → `/payroll`
  - `attendance` → `/attendance`
  - `announcement` → `/`
  - Default → stay on current page

