# Payroll Records: Open in Modal via Eye Icon

## Goal
In the Payroll page, remove the "Payroll Records" tab. Clicking the eye icon on a payroll period opens the payroll records in a modal instead. No existing functions or behavior change — only where the records are displayed.

## Current state (verified in `src/pages/Payroll.tsx`)
- `handleViewPeriod` sets `selectedPeriod` and switches `activeTab` to `'records'`.
- The "Payroll Records" tab (`TabsContent value="records"`) shows: a not-yet-processed warning, the records `DataTable`, `PayslipDialog`, and `ManualPayrollDialog`.
- Tabs today: Payroll Periods | Payroll Records | Salary Components | Salary Calculator.

## Changes (all in `src/pages/Payroll.tsx`)

1. **Remove the "Payroll Records" tab** from the `TabsList` and delete its `TabsContent`. Remaining tabs: Payroll Periods, Salary Components, Salary Calculator (calculator only for HR).

2. **Eye icon opens a modal**: `handleViewPeriod(periodId)` sets `selectedPeriod` and opens a new `recordsModalOpen` state (the tab switch is removed).

3. **New Payroll Records modal** (Radix `Dialog`, styled like existing dialogs):
   - Title: "Payroll Records" with the period range in the description.
   - Content is exactly what the old tab showed, unchanged:
     - "Payroll is not yet processed..." warning for draft/processing periods.
     - The same records `DataTable` (Employee, Type of Calculation, Basic, Gross, Deductions, Net Pay) with the same per-row eye/edit/delete actions, loading and empty states.
     - `PayslipDialog` and `ManualPayrollDialog` continue to open from the modal rows with identical behavior and download logic.
   - Table fits the modal: wide dialog (max-w ~5xl) with the table area scrollable inside (`overflow-auto`, max height) so long lists don't stretch the modal — same scroll approach used on the attendance terminal table.
   - Close via X, Close button, or clicking outside; closing clears the open flag.

4. **State cleanup**: `activeTab` still drives the remaining tabs; `recordsLoading` hook (`usePayrollRecords`) keeps working off `selectedPeriod`, so no data-fetch changes.

## Out of scope
- No changes to payroll computation, approval, deletion, downloads (summary, bulk payslips, payslip PDF), Manual Payroll, or Salary Components/Calculator.
- No backend changes.

## Verification
- Typecheck passes.
- Playwright: Payroll page loads, periods table renders, eye click opens the modal with records, payslip/edit/delete actions work inside the modal, remaining tabs still switch.
