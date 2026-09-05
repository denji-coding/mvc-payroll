# Payslip PDF download + green action icons

## 1. Payroll page: download a real PDF payslip

Today the "Download Payslip" button in the Payroll payslip dialog builds an HTML file and saves it as `payslip-<lastname>.html`. The employee portal (My Payslips) already produces a proper A4 PDF through the shared payslip generator.

Change: the Payroll payslip dialog will call the same PDF generator used by My Payslips, passing the employee details (ID, first/middle/last/suffix, position), the period dates, and the pay figures from the selected payroll record. The HTML builder and the `.html` blob download are removed, so HR gets the identical PDF employees receive.

Notes:
- The period start/end/pay date come from the selected payroll period.
- The download stays limited to approved/paid periods, as now.
- No payroll calculations or leave-credit logic change.

## 2. Green view/edit icons

Apply the brand green to the action icons on:
- Employees (eye + edit)
- Positions (edit)
- Branches (edit)
- Time Schedule (edit)

Buttons keep their current shape/size; only the icon color changes, using the existing primary green token (with a matching hover state). Delete icons stay red.

## Technical notes

- `src/pages/Payroll.tsx`: in `PayslipDialog`, replace `handleDownload` with a call to `generatePayslipPdf` from `@/lib/generatePayslipPdf`, mapping the record fields the same way `MyPayslips.tsx` does; pass period info via a new prop from the parent (selected period data).
- Icon color via `className="h-4 w-4 text-primary"` on the Eye/Edit icons in `Employees.tsx`, `Positions.tsx`, `Branches.tsx`, `TimeSchedule.tsx` (no hardcoded hex).
