# PDF header and payslip logo updates

## Changes
1. Update the Daily Time Record’s browser-print and downloaded PDF layouts to use the Reports-style company logo, company name, address, and green divider. Keep “DAILY TIME RECORD” below the divider and remove the duplicate company name directly under that title. Preserve the attendance table, remarks, totals, and signatures.
2. Update generated Reports PDFs: remove “Migrants Venture Corporation • HRM & Payroll System” from the footer; move each report title (including “Attendance Summary”) below the green divider and make it more prominent; move the generated date/time below the Prepared By name and role. Apply the same layout to all report types and pages.
3. Add the company logo to every mini payslip in the existing bulk-payslip PDF without changing the six-per-page layout or payroll calculations.

## Technical approach and verification
- Keep the current PDF tools: jsPDF for downloaded DTRs, print markup for browser printing, and react-pdf for reports and bulk payslips. Use the existing company-logo asset with the configured company logo where the current workflow supports it.
- Adjust header/table spacing so titles, dates, and logos do not overlap or force unexpected extra pages.
- Generate sample DTR, report, and bulk-payslip PDFs; visually inspect rendered pages and verify the print view and download actions where accessible.